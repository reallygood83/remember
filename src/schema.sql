CREATE TABLE IF NOT EXISTS memories (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  tags TEXT DEFAULT '[]',
  embedding BLOB,
  stability REAL DEFAULT 1.0,
  difficulty REAL DEFAULT 0.3,
  last_review TEXT,
  next_review TEXT,
  reps INTEGER DEFAULT 0,
  lapses INTEGER DEFAULT 0,
  state INTEGER DEFAULT 0,
  source TEXT,
  superseded_by TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS connections (
  from_id TEXT NOT NULL,
  to_id TEXT NOT NULL,
  weight REAL DEFAULT 1.0,
  reason TEXT,
  PRIMARY KEY (from_id, to_id),
  FOREIGN KEY (from_id) REFERENCES memories(id) ON DELETE CASCADE,
  FOREIGN KEY (to_id) REFERENCES memories(id) ON DELETE CASCADE
);

CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
  content,
  tags,
  category,
  content_rowid='rowid'
);

CREATE TRIGGER IF NOT EXISTS memories_ai AFTER INSERT ON memories BEGIN
  INSERT INTO memories_fts(rowid, content, tags, category)
  VALUES (NEW.rowid, NEW.content, NEW.tags, NEW.category);
END;

CREATE TRIGGER IF NOT EXISTS memories_ad AFTER DELETE ON memories BEGIN
  DELETE FROM memories_fts WHERE rowid = OLD.rowid;
END;

CREATE TRIGGER IF NOT EXISTS memories_au AFTER UPDATE ON memories BEGIN
  DELETE FROM memories_fts WHERE rowid = OLD.rowid;
  INSERT INTO memories_fts(rowid, content, tags, category)
  VALUES (NEW.rowid, NEW.content, NEW.tags, NEW.category);
END;
