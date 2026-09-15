const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const filename = process.env.DB_FILE || './data/school.sqlite';
const dbPath = path.isAbsolute(filename) ? filename : path.join(process.cwd(), filename);
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initializeDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Upgrade installations created by the original unified-users prototype.
  // Those tables cannot represent the explicit account model, so they are
  // retired before creating the replacement schema.
  const hasStudents = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'students'").get();
  const hasLegacyUsers = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'users'").get();
  if (!hasStudents && hasLegacyUsers) {
    const oldScores = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'scores'").get();
    if (oldScores) db.exec('DROP TABLE scores');
    db.exec('DROP TABLE users');
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      admission_number TEXT NOT NULL UNIQUE COLLATE NOCASE,
      class_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS teachers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      class_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS owner (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      username TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      subject TEXT NOT NULL COLLATE NOCASE,
      score REAL NOT NULL CHECK (score >= 0 AND score <= 100),
      recorded_by INTEGER NOT NULL REFERENCES teachers(id) ON DELETE RESTRICT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(student_id, subject)
    );
    CREATE TABLE IF NOT EXISTS subjects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE COLLATE NOCASE
    );
    CREATE INDEX IF NOT EXISTS idx_students_class ON students(class_name);
    CREATE INDEX IF NOT EXISTS idx_teachers_class ON teachers(class_name);
    CREATE INDEX IF NOT EXISTS idx_scores_student ON scores(student_id);
  `);

  if (!db.prepare('SELECT 1 FROM schema_migrations WHERE version = 1').get()) {
    db.exec(`
      INSERT INTO schema_migrations (version) VALUES (1);
    `);
    const seed = db.transaction(() => {
      const insertSubject = db.prepare('INSERT OR IGNORE INTO subjects (name) VALUES (?)');
      ['Mathematics', 'English', 'Science', 'Social Studies'].forEach((subject) => insertSubject.run(subject));
    });
    seed();
  }
}

function ownerExists() {
  return Boolean(db.prepare('SELECT id FROM owner WHERE id = 1').get());
}

module.exports = { db, initializeDatabase, ownerExists };
