const bcrypt = require("bcrypt");
const pool = require("../config/database");

function regenerateSession(req) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function saveSession(req) {
  return new Promise((resolve, reject) => {
    req.session.save((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

// LOGIN
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (
      typeof username !== "string" ||
      typeof password !== "string" ||
      !username.trim() ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message: "Username and password are required.",
      });
    }

    const result = await pool.query(
      `SELECT id, full_name, username, email,
              password_hash, role, is_active
       FROM users
       WHERE username = $1 OR email = $1
       LIMIT 1`,
      [username.trim()]
    );

    const user = result.rows[0];

    if (!user || !user.is_active) {
      return res.status(401).json({
        success: false,
        message: "Invalid username or password.",
      });
    }

    const passwordMatch = await bcrypt.compare(
      password,
      user.password_hash
    );

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid username or password.",
      });
    }

    // Prevent session fixation
    await regenerateSession(req);

    // Store only safe user information
    req.session.user = {
      id: user.id,
      fullName: user.full_name,
      username: user.username,
      email: user.email,
      role: user.role,
    };

    await saveSession(req);

    res.json({
      success: true,
      message: "Login successful.",
      user: req.session.user,
    });

  } catch (error) {
    console.error("Login error:", error);

    res.status(500).json({
      success: false,
      message: "Login failed due to a server error.",
    });
  }
};

// CHECK CURRENT USER
exports.me = (req, res) => {
  res.json({
    success: true,
    user: req.session.user,
  });
};

// LOGOUT
exports.logout = (req, res) => {
  req.session.destroy((error) => {
    if (error) {
      return res.status(500).json({
        success: false,
        message: "Logout failed.",
      });
    }

    res.clearCookie("missnoori.sid", {
      httpOnly: true,
      secure: process.env.APP_ENV === "production",
      sameSite:
        process.env.APP_ENV === "production" ? "none" : "lax",
      path: "/",
    });

    res.json({
      success: true,
      message: "Logged out successfully.",
    });
  });
};