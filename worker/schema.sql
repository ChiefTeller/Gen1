CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, student TEXT NOT NULL, title TEXT NOT NULL, nickname TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('pending','published','rejected','deleted')), files_json TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_projects_status_created ON projects(status,created_at);
CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL);
