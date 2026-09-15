require('dotenv').config();

const bcrypt = require('bcryptjs');
const { db, initializeDatabase } = require('./db');

initializeDatabase();

const demoPassword = 'DemoPass123!';
const hash = bcrypt.hashSync(demoPassword, 12);

const seed = db.transaction(() => {
  db.prepare(`
    INSERT OR IGNORE INTO owner (id, username, password_hash)
    VALUES (1, ?, ?)
  `).run('admin', hash);

  db.prepare(`
    INSERT OR IGNORE INTO teachers (full_name, email, class_name, password_hash)
    VALUES (?, ?, ?, ?)
  `).run('Amina Teacher', 'teacher@example.com', 'Class 10A', hash);

  const teacher = db.prepare('SELECT id FROM teachers WHERE email = ?').get('teacher@example.com');
  const insertStudent = db.prepare(`
    INSERT OR IGNORE INTO students
      (full_name, email, admission_number, class_name, password_hash)
    VALUES (?, ?, ?, ?, ?)
  `);

  insertStudent.run('Sam Student', 'sam@example.com', 'STU-1001', 'Class 10A', hash);
  insertStudent.run('Priya Student', 'priya@example.com', 'STU-1002', 'Class 10A', hash);

  const insertScore = db.prepare(`
    INSERT INTO scores (student_id, subject, score, recorded_by, updated_at)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(student_id, subject) DO UPDATE SET
      score = excluded.score,
      recorded_by = excluded.recorded_by,
      updated_at = CURRENT_TIMESTAMP
  `);

  const scores = [
    ['STU-1001', 'Mathematics', 88],
    ['STU-1001', 'English', 91],
    ['STU-1001', 'Science', 86],
    ['STU-1002', 'Mathematics', 94],
    ['STU-1002', 'English', 89],
    ['STU-1002', 'Science', 92]
  ];

  for (const [admissionNumber, subject, score] of scores) {
    const student = db.prepare('SELECT id FROM students WHERE admission_number = ?').get(admissionNumber);
    insertScore.run(student.id, subject, score, teacher.id);
  }
});

seed();
console.log('Demo data created or refreshed.');
console.log('Owner: admin / DemoPass123!');
console.log('Teacher: teacher@example.com / DemoPass123!');
console.log('Student: STU-1001 or sam@example.com / DemoPass123!');
console.log('Student: STU-1002 or priya@example.com / DemoPass123!');
