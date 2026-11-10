
function requireAuth(req, res, next) {
  // Check whether a valid session exists
  const user = req.session?.user;

  if (!user || !user.id) {
    return res.status(401).json({
      success: false,
      message: "Authentication required.",
    });
  }

  // Make authenticated user available to controllers
  req.user = user;

  return next();
}

module.exports = requireAuth;
