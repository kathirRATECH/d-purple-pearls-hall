const { db } = require('../db');

function loadAccount(req, res, next) {
  req.account = null;
  res.locals.account = null;
  if (req.session.accountType && req.session.accountId) {
    const queries = {
      student: 'SELECT id, full_name AS fullName, email, admission_number AS admissionNumber, class_name AS className FROM students WHERE id = ?',
      teacher: 'SELECT id, full_name AS fullName, email, class_name AS className FROM teachers WHERE id = ?',
      owner: 'SELECT id, username FROM owner WHERE id = 1'
    };
    const account = queries[req.session.accountType]
      ? db.prepare(queries[req.session.accountType]).get(req.session.accountId)
      : null;
    if (account) {
      req.account = { ...account, type: req.session.accountType };
      res.locals.account = req.account;
    } else {
      req.session.destroy(() => {});
    }
  }
  next();
}

function requireType(type, loginPath) {
  return (req, res, next) => {
    if (!req.account || req.account.type !== type) return res.redirect(loginPath);
    next();
  };
}

const requireStudent = requireType('student', '/student/login');
const requireTeacher = requireType('teacher', '/teacher/login');
const requireOwner = requireType('owner', '/owner/login');

module.exports = { loadAccount, requireStudent, requireTeacher, requireOwner };
