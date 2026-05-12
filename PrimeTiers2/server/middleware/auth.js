/**
 * Middleware: require admin session
 */
function requireAdmin(req, res, next) {
  if (req.session && req.session.adminId) {
    return next();
  }
  // API requests get JSON 401
  if (req.path.startsWith('/api/admin')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  // Browser requests redirect to login
  return res.redirect('/admin/login');
}

module.exports = { requireAdmin };
