require('dotenv').config();

const express = require('express');
const session = require('express-session');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { initializeDatabase, ownerExists } = require('./db');
const { loadAccount } = require('./middleware/auth');
const studentRoutes = require('./routes/student');
const teacherRoutes = require('./routes/teacher');
const ownerRoutes = require('./routes/owner');

initializeDatabase();

const app = express();
const port = Number(process.env.PORT) || 3000;
const host = process.env.HOST || '0.0.0.0';
const isProduction = process.env.NODE_ENV === 'production';
if (isProduction && (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32)) {
  throw new Error('SESSION_SECRET must be at least 32 characters in production.');
}
if (isProduction) app.set('trust proxy', 1);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: false, limit: '20kb' }));
app.use(express.static(path.join(__dirname, 'public'), { maxAge: isProduction ? '1d' : 0 }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'development-only-change-this-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    maxAge: 1000 * 60 * 60 * 8
  }
}));
app.use(loadAccount);
app.use('/student/login', rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false }));
app.use('/teacher/login', rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false }));
app.use('/owner/login', rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false }));
app.use('/student/signup', rateLimit({ windowMs: 60 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false }));
app.use('/teacher/signup', rateLimit({ windowMs: 60 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false }));
app.use('/', studentRoutes);
app.use('/', teacherRoutes);
app.use('/', ownerRoutes);

app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));
app.get('/', (req, res) => {
  if (req.account) return res.redirect(`/${req.account.type}/dashboard`);
  res.render('home', { title: 'School Portal', ownerReady: ownerExists() });
});

app.use((req, res) => res.status(404).render('error', { title: 'Page not found', message: 'We could not find that page.' }));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render('error', { title: 'Something went wrong', message: 'An unexpected error occurred. Please try again.' });
});

app.listen(port, host, () => console.log(`School portal listening on ${host}:${port}`));
