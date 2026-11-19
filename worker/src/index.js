// GEN1 CLASS API — Cloudflare Worker + D1 + R2.
// Secrets: ADMIN_PASSWORD_HASH = saltHex:pbkdf2Hex (150000 iterations); SESSION_SECRET = random >=32 chars.
// Set FRONTEND_ORIGIN to the published GitHub Pages origin.
const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...headers}});
const hex=b=>[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');
const bytes=s=>new TextEncoder().encode(s);
const allowed={html:'text/html; charset=utf-8',css:'text/css; charset=utf-8',js:'text/javascript; charset=utf-8',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',gif:'image/gif',webp:'image/webp'};
const safeName=n=>/^[\w. -]{1,100}$/.test(n)&&!n.startsWith('.')&&!n.includes('..');
const validText=(s,max)=>typeof s==='string'&&s.trim().length>0&&s.trim().length<=max;
const id=()=>crypto.randomUUID();
async function hmac(secret,value){const k=await crypto.subtle.importKey('raw',bytes(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return hex(await crypto.subtle.sign('HMAC',k,bytes(value)))}
async function session(env,token){if(!token||!env.SESSION_SECRET)return false;const [exp,sig]=token.split('.');if(!/^\d+$/.test(exp)||!sig||Number(exp)<Date.now())return false;return await hmac(env.SESSION_SECRET,exp)===sig}
async function checkPassword(stored,password){if(!stored||!password)return false;const [salt,expected]=stored.split(':');if(!/^[a-f0-9]{32}$/.test(salt)||!/^[a-f0-9]{64}$/.test(expected))return false;const key=await crypto.subtle.importKey('raw',bytes(password),'PBKDF2',false,['deriveBits']);const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt:Uint8Array.from(salt.match(/../g).map(x=>parseInt(x,16))),iterations:150000,hash:'SHA-256'},key,256);return hex(bits)===expected}
async function getBody(request){try{return await request.json()}catch{return {}}}
export default {async fetch(request,env){
 const url=new URL(request.url),path=url.pathname,method=request.method,origin=request.headers.get('origin');
 const cors=origin===env.FRONTEND_ORIGIN?{'access-control-allow-origin':origin,'vary':'Origin','access-control-allow-methods':'GET,POST,OPTIONS','access-control-allow-headers':'Content-Type,Authorization'}:{};
 const reply=(d,s=200)=>json(d,s,cors);
 if(method==='OPTIONS')return origin===env.FRONTEND_ORIGIN?new Response(null,{status:204,headers:cors}):reply({error:'Origin not allowed'},403);
 try{
 if(method==='GET'&&path==='/health')return reply({ok:true});
 if(method==='GET'&&path==='/projects'){const {results}=await env.DB.prepare("SELECT id,title,nickname FROM projects WHERE status='published' ORDER BY created_at DESC LIMIT 500").all();return reply(results.map(p=>({...p,url:new URL('/site/'+p.id+'/',url.origin).href})))}
 if(method==='GET'&&path.startsWith('/site/')){
  const parts=path.split('/').filter(Boolean);if(parts.length<2||parts.length>3)return reply({error:'Not found'},404);
  const projectId=parts[1],filename=parts[2]||'index.html';
  if(!/^[a-f0-9-]{36}$/.test(projectId)||!safeName(filename))return reply({error:'Not found'},404);
  const p=await env.DB.prepare("SELECT id FROM projects WHERE id=? AND status='published'").bind(projectId).first();if(!p)return reply({error:'Not found'},404);
  const obj=await env.FILES.get('published/'+projectId+'/'+filename);if(!obj)return reply({error:'Not found'},404);
  const ext=filename.split('.').pop().toLowerCase(),type=allowed[ext]||'application/octet-stream';
  return new Response(obj.body,{headers:{'content-type':type,'x-content-type-options':'nosniff','referrer-policy':'no-referrer','content-security-policy':"sandbox allow-scripts; default-src 'self' data: blob:; connect-src 'none'; form-action 'none'; frame-ancestors *",'cache-control':'public, max-age=300'}});
 }
 if(method==='POST'&&path==='/submissions'){
  if(origin!==env.FRONTEND_ORIGIN)return reply({error:'Origin not allowed'},403);
  if(Number(request.headers.get('content-length')||0)>6*1024*1024)return reply({error:'Upload too large'},413);
  const ip=request.headers.get('cf-connecting-ip')||'unknown',window=Math.floor(Date.now()/3600000),rateKey=await hmac(env.SESSION_SECRET,ip+':'+window);
  const rate=await env.DB.prepare('SELECT count FROM rate_limits WHERE key=?').bind(rateKey).first();
  if(rate&&rate.count>=5)return reply({error:'Too many submissions; try later'},429);
  const form=await request.formData(),student=form.get('student'),nickname=form.get('nickname'),title=form.get('title'),files=form.getAll('files');
  if(!validText(student,80)||!validText(nickname,40)||!validText(title,80)||!files.length||files.length>25)return reply({error:'Invalid submission'},400);
  if(!files.some(f=>f.name==='index.html'))return reply({error:'index.html is required'},400);
  let total=0;const seen=new Set();
  for(const f of files){if(typeof f==='string'||!safeName(f.name))return reply({error:'Invalid filename'},400);const ext=f.name.split('.').pop().toLowerCase();if(!allowed[ext]||seen.has(f.name.toLowerCase()))return reply({error:'Unsupported or duplicate file'},400);seen.add(f.name.toLowerCase());total+=f.size;if(total>5*1024*1024)return reply({error:'Project exceeds 5MB'},413)}
  const projectId=id();const uploaded=[];
  try{for(const f of files){const key='pending/'+projectId+'/'+f.name;await env.FILES.put(key,await f.arrayBuffer());uploaded.push(key)}
    await env.DB.prepare("INSERT INTO projects (id,student,title,nickname,status,files_json,created_at) VALUES (?,?,?,?,?,?,?)").bind(projectId,student.trim(),title.trim(),nickname.trim(),'pending',JSON.stringify(files.map(f=>f.name)),Date.now()).run();
    await env.DB.prepare('INSERT INTO rate_limits(key,count) VALUES (?,1) ON CONFLICT(key) DO UPDATE SET count=count+1').bind(rateKey).run();
  }catch(e){await Promise.all(uploaded.map(k=>env.FILES.delete(k)));throw e}
  return reply({id:projectId,status:'pending'},201);
 }
 if(method==='POST'&&path==='/admin/login'){
  if(origin!==env.FRONTEND_ORIGIN)return reply({error:'Origin not allowed'},403);
  const body=await getBody(request);
  if(body.username!=='nadav'||!await checkPassword(env.ADMIN_PASSWORD_HASH,body.password))return reply({error:'Invalid credentials'},401);
  const exp=String(Date.now()+60*60*1000);return reply({token:exp+'.'+await hmac(env.SESSION_SECRET,exp)});
 }
 if(path.startsWith('/admin/')){
  if(origin!==env.FRONTEND_ORIGIN||!await session(env,(request.headers.get('authorization')||'').replace(/^Bearer /,'')))return reply({error:'Unauthorized'},401);
  if(method==='GET'&&path==='/admin/submissions'){const {results}=await env.DB.prepare("SELECT id,student,title,nickname FROM projects WHERE status='pending' ORDER BY created_at ASC LIMIT 200").all();return reply(results)}
  if(method==='GET'&&path==='/admin/projects'){const {results}=await env.DB.prepare("SELECT id,title,nickname FROM projects WHERE status='published' ORDER BY created_at DESC LIMIT 500").all();return reply(results)}
  const m=path.match(/^\/admin\/projects\/([a-f0-9-]{36})\/(approve|reject|rename|delete)$/);
  if(method==='POST'&&m){
   const [,pid,action]=m;const p=await env.DB.prepare('SELECT * FROM projects WHERE id=?').bind(pid).first();if(!p)return reply({error:'Not found'},404);
   if(action==='rename'){const body=await getBody(request);if(!validText(body.title,80))return reply({error:'Invalid title'},400);await env.DB.prepare('UPDATE projects SET title=? WHERE id=?').bind(body.title.trim(),pid).run()}
   if(action==='approve'){if(p.status!=='pending')return reply({error:'Not pending'},409);const files=JSON.parse(p.files_json);for(const f of files){const obj=await env.FILES.get('pending/'+pid+'/'+f);if(!obj)return reply({error:'Missing project file'},409);await env.FILES.put('published/'+pid+'/'+f,obj.body)}await env.DB.prepare("UPDATE projects SET status='published' WHERE id=?").bind(pid).run();await Promise.all(files.map(f=>env.FILES.delete('pending/'+pid+'/'+f)))}
   if(action==='reject'||action==='delete'){const prefix=p.status==='published'?'published/':'pending/';await env.DB.prepare("UPDATE projects SET status=? WHERE id=?").bind(action==='delete'?'deleted':'rejected',pid).run();await Promise.all(JSON.parse(p.files_json).map(f=>env.FILES.delete(prefix+pid+f)))}
   return reply({ok:true});
  }
 }
 return reply({error:'Not found'},404);
 }catch(e){console.error('GEN1 API failure',e);return reply({error:'Server error'},500)}
}};