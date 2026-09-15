const { db } = require('../db');

async function loadAccount(req, res, next) {
  req.account = null;
  res.locals.account = null;
  if (req.session.accountType && req.session.accountId) {
    const queries = {
      student: ['SELECT id, full_name AS "fullName", email, admission_number AS "admissionNumber", class_name AS "className" FROM students WHERE id = $1', 'student'],
      teacher: ['SELECT id, full_name AS "fullName", email, class_name AS "className" FROM teachers WHERE id = $1', 'teacher'],
      owner: ['SELECT id, username FROM owner WHERE id = $1', 'owner']
    };
    const query = queries[req.session.accountType];
    const result = query ? await db.query(query[0], [req.session.accountId]) : { rows: [] };
    if (result.rows[0]) {
      req.account = { ...result.rows[0], type: query[1] };
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

module.exports = {
  loadAccount,
  requireStudent: requireType('student', '/student/login'),
  requireTeacher: requireType('teacher', '/teacher/login'),
  requireOwner: requireType('owner', '/owner/login')
};
