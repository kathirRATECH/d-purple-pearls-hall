const express = require('express');
const bcrypt = require('bcryptjs');
const { db, ownerExists } = require('../db');
const { requireOwner } = require('../middleware/auth');

const router = express.Router();
const clean = (value) => String(value || '').trim();

router.get('/owner/setup', (req, res) => {
  if (ownerExists()) return res.redirect('/owner/login');
  res.render('owner-setup', { title: 'Owner setup', error: null, values: {} });
});

router.post('/owner/setup', (req, res) => {
  if (ownerExists()) return res.redirect('/owner/login');
  const values = { username: clean(req.body.username) };
  const password = String(req.body.password || '');
  if (!/^[a-zA-Z0-9_.-]{3,40}$/.test(values.username)) return res.status(400).render('owner-setup', { title: 'Owner setup', error: 'Username must be 3–40 letters, numbers, dots, dashes, or underscores.', values });
  if (password.length < 8 || password.length > 128) return res.status(400).render('owner-setup', { title: 'Owner setup', error: 'Password must be 8–128 characters.', values });
  try {
    db.prepare('INSERT INTO owner (id, username, password_hash) VALUES (1, ?, ?)').run(values.username, bcrypt.hashSync(password, 12));
    res.redirect('/owner/login?setup=1');
  } catch (error) {
    return res.status(400).render('owner-setup', { title: 'Owner setup', error: 'Owner setup could not be completed. Please try again.', values });
  }
});

router.get('/owner/login', (req, res) => {
  if (!ownerExists()) return res.redirect('/owner/setup');
  if (req.account) return res.redirect('/' + req.account.type + '/dashboard');
  res.render('owner-login', { title: 'Owner login', error: null, query: req.query, values: {} });
});

router.post('/owner/login', (req, res) => {
  const username = clean(req.body.username);
  const password = String(req.body.password || '');
  const owner = db.prepare('SELECT * FROM owner WHERE username = ? COLLATE NOCASE').get(username);
  if (!owner || !bcrypt.compareSync(password, owner.password_hash)) {
    return res.status(400).render('owner-login', { title: 'Owner login', error: 'Username or password is incorrect.', query: {}, values: { username } });
  }
  req.session.regenerate((error) => {
    if (error) return res.status(500).render('error', { title: 'Sign-in error', message: 'Please try again.' });
    req.session.accountType = 'owner';
    req.session.accountId = 1;
    res.redirect('/owner/dashboard');
  });
});

router.get('/owner/dashboard', requireOwner, (req, res) => {
  const selectedClass = clean(req.query.className);
  const classes = db.prepare('SELECT DISTINCT class_name AS className FROM students ORDER BY class_name').all();
  const classFilter = selectedClass && classes.some((item) => item.className === selectedClass) ? selectedClass : '';
  const ranking = db.prepare(`
    SELECT s.id, s.full_name AS fullName, s.class_name AS className, ROUND(AVG(sc.score), 1) AS average, COUNT(sc.id) AS scoreCount
    FROM students s JOIN scores sc ON sc.student_id = s.id
    WHERE (? = '' OR s.class_name = ?)
    GROUP BY s.id ORDER BY average DESC, s.full_name ASC
  `).all(classFilter, classFilter);
  const allSchool = db.prepare(`
    SELECT s.full_name AS fullName, s.admission_number AS admissionNumber, s.class_name AS className,
           ROUND(AVG(sc.score), 1) AS average, COUNT(sc.id) AS scoreCount
    FROM students s LEFT JOIN scores sc ON sc.student_id = s.id
    GROUP BY s.id ORDER BY s.class_name, average DESC, s.full_name ASC
  `).all();
  const counts = {
    students: db.prepare('SELECT COUNT(*) AS count FROM students').get().count,
    teachers: db.prepare('SELECT COUNT(*) AS count FROM teachers').get().count,
    scores: db.prepare('SELECT COUNT(*) AS count FROM scores').get().count
  };
  res.render('owner-dashboard', { title: 'Owner dashboard', classes, classFilter, ranking, allSchool, counts });
});

router.post('/owner/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/owner/login'));
});

module.exports = router;
