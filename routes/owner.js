const express = require('express');
const bcrypt = require('bcryptjs');
const { db, ownerExists } = require('../db');
const asyncHandler = require('../middleware/async');
const { requireOwner } = require('../middleware/auth');
const router = express.Router();
const clean = (value) => String(value || '').trim();

router.get('/owner/setup', asyncHandler(async (req, res) => { if (await ownerExists()) return res.redirect('/owner/login'); res.render('owner-setup', { title: 'Owner setup', error: null, values: {} }); }));
router.post('/owner/setup', asyncHandler(async (req, res) => {
  if (await ownerExists()) return res.redirect('/owner/login');
  const values = { username: clean(req.body.username) }; const password = String(req.body.password || '');
  if (!/^[a-zA-Z0-9_.-]+(?: [a-zA-Z0-9_.-]+)*$/.test(values.username) || values.username.length < 3 || values.username.length > 40) return res.status(400).render('owner-setup', { title: 'Owner setup', error: 'Username must be 3–40 characters using letters, numbers, spaces, dots, dashes, or underscores.', values });
  if (password.length < 8 || password.length > 128) return res.status(400).render('owner-setup', { title: 'Owner setup', error: 'Password must be 8–128 characters.', values });
  try { await db.query('INSERT INTO owner (id, username, password_hash) VALUES (1, $1, $2)', [values.username, bcrypt.hashSync(password, 12)]); res.redirect('/owner/login?setup=1'); }
  catch (error) { res.status(400).render('owner-setup', { title: 'Owner setup', error: 'Owner setup could not be completed. Please try again.', values }); }
}));
router.get('/owner/login', asyncHandler(async (req, res) => { if (!await ownerExists()) return res.redirect('/owner/setup'); if (req.account) return res.redirect('/' + req.account.type + '/dashboard'); res.render('owner-login', { title: 'Owner login', error: null, query: req.query, values: {} }); }));
router.post('/owner/login', asyncHandler(async (req, res) => {
  const username = clean(req.body.username); const owner = (await db.query('SELECT * FROM owner WHERE LOWER(username) = LOWER($1)', [username])).rows[0];
  if (!owner || !bcrypt.compareSync(String(req.body.password || ''), owner.password_hash)) return res.status(400).render('owner-login', { title: 'Owner login', error: 'Username or password is incorrect.', query: {}, values: { username } });
  req.session.regenerate((error) => { if (error) return res.status(500).render('error', { title: 'Sign-in error', message: 'Please try again.' }); req.session.accountType = 'owner'; req.session.accountId = 1; res.redirect('/owner/dashboard'); });
}));
router.get('/owner/dashboard', requireOwner, asyncHandler(async (req, res) => {
  const selectedClass = clean(req.query.className);
  const classes = (await db.query('SELECT DISTINCT class_name AS "className" FROM students ORDER BY class_name')).rows;
  const classFilter = selectedClass && classes.some((item) => item.className === selectedClass) ? selectedClass : '';
  const ranking = (await db.query(`SELECT s.id, s.full_name AS "fullName", s.class_name AS "className", ROUND(AVG(sc.score), 1) AS average, COUNT(sc.id)::integer AS "scoreCount" FROM students s JOIN scores sc ON sc.student_id = s.id WHERE ($1 = '' OR s.class_name = $1) GROUP BY s.id ORDER BY average DESC, s.full_name ASC`, [classFilter])).rows.map((row) => ({ ...row, average: Number(row.average) }));
  const allSchool = (await db.query(`SELECT s.full_name AS "fullName", s.admission_number AS "admissionNumber", s.class_name AS "className", ROUND(AVG(sc.score), 1) AS average, COUNT(sc.id)::integer AS "scoreCount" FROM students s LEFT JOIN scores sc ON sc.student_id = s.id GROUP BY s.id ORDER BY s.class_name, average DESC NULLS LAST, s.full_name ASC`)).rows.map((row) => ({ ...row, average: row.average === null ? null : Number(row.average) }));
  const countsResult = await db.query('SELECT (SELECT COUNT(*)::integer FROM students) AS students, (SELECT COUNT(*)::integer FROM teachers) AS teachers, (SELECT COUNT(*)::integer FROM scores) AS scores');
  res.render('owner-dashboard', { title: 'Owner dashboard', classes, classFilter, ranking, allSchool, counts: countsResult.rows[0] });
}));
router.post('/owner/logout', (req, res) => req.session.destroy(() => res.redirect('/owner/login')));
module.exports = router;
