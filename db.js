const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required.');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined
});

const db = {
  query(text, values) {
    return pool.query(text, values);
  }
};

async function initializeDatabase() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS students (
      id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      admission_number TEXT NOT NULL UNIQUE,
      class_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS teachers (
      id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      class_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS owner (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS scores (
      id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      subject TEXT NOT NULL,
      score NUMERIC NOT NULL CHECK (score >= 0 AND score <= 100),
      recorded_by INTEGER NOT NULL REFERENCES teachers(id) ON DELETE RESTRICT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(student_id, subject)
    );
    CREATE TABLE IF NOT EXISTS subjects (
      id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      name TEXT NOT NULL UNIQUE
    );
    CREATE INDEX IF NOT EXISTS idx_students_class ON students(class_name);
    CREATE INDEX IF NOT EXISTS idx_teachers_class ON teachers(class_name);
    CREATE INDEX IF NOT EXISTS idx_scores_student ON scores(student_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_students_admission_ci ON students (LOWER(admission_number));
    CREATE UNIQUE INDEX IF NOT EXISTS idx_teachers_email_ci ON teachers (LOWER(email));
    CREATE UNIQUE INDEX IF NOT EXISTS idx_owner_username_ci ON owner (LOWER(username));
  `);
  await db.query(
    `INSERT INTO schema_migrations (version) VALUES (1) ON CONFLICT (version) DO NOTHING`
  );
  await db.query(`
    INSERT INTO subjects (name) VALUES
      ('Mathematics'), ('English'), ('Science'), ('Social Studies')
    ON CONFLICT (name) DO NOTHING
  `);
}

async function ownerExists() {
  const result = await db.query('SELECT id FROM owner WHERE id = 1');
  return result.rowCount > 0;
}

module.exports = { db, pool, initializeDatabase, ownerExists };
