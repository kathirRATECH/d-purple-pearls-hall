const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../db');
const asyncHandler = require('../middleware/async');
const { requireStudent } = require('../middleware/auth');

const router = express.Router();
const clean = (value) => String(value || '').trim();
const validEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const form = (res, status, error, values = {}) => res.status(status).render('student-signup', { title: 'Student signup', error, values });

router.get('/student/signup', (req, res) => {
  if (req.account) return res.redirect('/' + req.account.type + '/dashboard');
  res.render('student-signup', { title: 'Student signup', error: null, values: {} });
});
router.post('/student/signup', asyncHandler(async (req, res) => {
  const values = { fullName: clean(req.body.fullName), email: clean(req.body.email).toLowerCase(), admissionNumber: clean(req.body.admissionNumber), className: clean(req.body.className) };
  const password = String(req.body.password || '');
  if (values.fullName.length < 2 || values.fullName.length > 80) return form(res, 400, 'Enter a name between 2 and 80 characters.', values);
  if (!validEmail(values.email) || values.email.length > 160) return form(res, 400, 'Enter a valid email address.', values);
  if (values.admissionNumber.length < 2 || values.admissionNumber.length > 40) return form(res, 400, 'Enter a valid admission number.', values);
  if (!values.className || values.className.length > 60) return form(res, 400, 'Enter your class.', values);
  if (password.length < 8 || password.length > 128) return form(res, 400, 'Password must be 8–128 characters.', values);
  try {
    await db.query('INSERT INTO students (full_name, email, admission_number, class_name, password_hash) VALUES ($1, $2, $3, $4, $5)', [values.fullName, values.email, values.admissionNumber, values.className, bcrypt.hashSync(password, 12)]);
    res.redirect('/student/login?created=1');
  } catch (error) {
    if (error.code === '23505') return form(res, 400, 'That email or admission number is already registered.', values);
    throw error;
  }
}));
router.get('/student/login', (req, res) => {
  if (req.account) return res.redirect('/' + req.account.type + '/dashboard');
  res.render('student-login', { title: 'Student login', error: null, query: req.query, values: {} });
});
router.post('/student/login', asyncHandler(async (req, res) => {
  const identifier = clean(req.body.identifier);
  const result = await db.query('SELECT * FROM students WHERE LOWER(email) = LOWER($1) OR LOWER(admission_number) = LOWER($1)', [identifier]);
  const student = result.rows[0];
  if (!student || !bcrypt.compareSync(String(req.body.password || ''), student.password_hash)) return res.status(400).render('student-login', { title: 'Student login', error: 'Admission number/email or password is incorrect.', query: {}, values: { identifier } });
  req.session.regenerate((error) => {
    if (error) return res.status(500).render('error', { title: 'Sign-in error', message: 'Please try again.' });
    req.session.accountType = 'student'; req.session.accountId = student.id; res.redirect('/student/dashboard');
  });
}));
router.get('/student/dashboard', requireStudent, asyncHandler(async (req, res) => {
  const scoreResult = await db.query('SELECT subject, score, updated_at AS "updatedAt" FROM scores WHERE student_id = $1 ORDER BY subject', [req.account.id]);
  const scores = scoreResult.rows.map((row) => ({ ...row, score: Number(row.score) }));
  const average = scores.length ? scores.reduce((sum, row) => sum + row.score, 0) / scores.length : 0;
  const ranking = (await db.query(`SELECT s.id, s.full_name AS "fullName", s.class_name AS "className", ROUND(AVG(sc.score), 1) AS average FROM students s JOIN scores sc ON sc.student_id = s.id GROUP BY s.id ORDER BY average DESC, s.full_name ASC LIMIT 20`)).rows.map((row) => ({ ...row, average: Number(row.average) }));
  const position = ranking.findIndex((row) => row.id === req.account.id) + 1;
  res.render('student-dashboard', { title: 'Student dashboard', scores, average, ranking, position });
}));
router.post('/student/logout', (req, res) => req.session.destroy(() => res.redirect('/student/login')));
module.exports = router;
