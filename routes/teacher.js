const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../db');
const { requireTeacher } = require('../middleware/auth');

const router = express.Router();
const clean = (value) => String(value || '').trim();

function signupForm(res, status, error, values = {}) {
  return res.status(status).render('teacher-signup', { title: 'Teacher signup', error, values });
}

router.get('/teacher/signup', (req, res) => {
  if (req.account) return res.redirect('/' + req.account.type + '/dashboard');
  res.render('teacher-signup', { title: 'Teacher signup', error: null, values: {} });
});

router.post('/teacher/signup', (req, res) => {
  const values = { fullName: clean(req.body.fullName), email: clean(req.body.email).toLowerCase(), className: clean(req.body.className) };
  const password = String(req.body.password || '');
  if (values.fullName.length < 2 || values.fullName.length > 80) return signupForm(res, 400, 'Enter a name between 2 and 80 characters.', values);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email) || values.email.length > 160) return signupForm(res, 400, 'Enter a valid email address.', values);
  if (!values.className || values.className.length > 60) return signupForm(res, 400, 'Enter the class you teach.', values);
  if (password.length < 8 || password.length > 128) return signupForm(res, 400, 'Password must be 8–128 characters.', values);
  try {
    db.prepare('INSERT INTO teachers (full_name, email, class_name, password_hash) VALUES (?, ?, ?, ?)').run(values.fullName, values.email, values.className, bcrypt.hashSync(password, 12));
    res.redirect('/teacher/login?created=1');
  } catch (error) {
    if (String(error.message).includes('UNIQUE')) return signupForm(res, 400, 'That email is already registered.', values);
    throw error;
  }
});

router.get('/teacher/login', (req, res) => {
  if (req.account) return res.redirect('/' + req.account.type + '/dashboard');
  res.render('teacher-login', { title: 'Teacher login', error: null, query: req.query, values: {} });
});

router.post('/teacher/login', (req, res) => {
  const email = clean(req.body.email).toLowerCase();
  const password = String(req.body.password || '');
  const teacher = db.prepare('SELECT * FROM teachers WHERE email = ? COLLATE NOCASE').get(email);
  if (!teacher || !bcrypt.compareSync(password, teacher.password_hash)) {
    return res.status(400).render('teacher-login', { title: 'Teacher login', error: 'Email or password is incorrect.', query: {}, values: { email } });
  }
  req.session.regenerate((error) => {
    if (error) return res.status(500).render('error', { title: 'Sign-in error', message: 'Please try again.' });
    req.session.accountType = 'teacher';
    req.session.accountId = teacher.id;
    res.redirect('/teacher/dashboard');
  });
});

router.get('/teacher/dashboard', requireTeacher, (req, res) => {
  const students = db.prepare(`
    SELECT s.id, s.full_name AS fullName, s.email, s.admission_number AS admissionNumber,
           ROUND(AVG(sc.score), 1) AS average, COUNT(sc.id) AS scoreCount
    FROM students s LEFT JOIN scores sc ON sc.student_id = s.id
    WHERE s.class_name = ?
    GROUP BY s.id ORDER BY average DESC, s.full_name ASC
  `).all(req.account.className);
  const subjects = db.prepare('SELECT name FROM subjects ORDER BY name').all();
  res.render('teacher-dashboard', { title: 'Teacher dashboard', students, subjects, className: req.account.className });
});

router.post('/teacher/scores', requireTeacher, (req, res) => {
  const studentId = Number(req.body.studentId);
  const subject = clean(req.body.subject);
  const score = Number(req.body.score);
  if (!Number.isInteger(studentId) || !subject || subject.length > 80 || !Number.isFinite(score) || score < 0 || score > 100) {
    return res.status(400).render('error', { title: 'Invalid score', message: 'Choose a student, subject, and score from 0 to 100.' });
  }
  const student = db.prepare('SELECT id FROM students WHERE id = ? AND class_name = ?').get(studentId, req.account.className);
  if (!student) return res.status(403).render('error', { title: 'Score not saved', message: 'You can only update students in your own class.' });
  db.prepare(`
    INSERT INTO scores (student_id, subject, score, recorded_by, updated_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(student_id, subject) DO UPDATE SET score = excluded.score, recorded_by = excluded.recorded_by, updated_at = CURRENT_TIMESTAMP
  `).run(studentId, subject, score, req.account.id);
  res.redirect('/teacher/dashboard?saved=1');
});

router.post('/teacher/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/teacher/login'));
});

module.exports = router;
