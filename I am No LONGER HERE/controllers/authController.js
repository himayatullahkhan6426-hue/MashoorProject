
const bcrypt = require("bcrypt");
const pool = require("../config/database");

// Session helpers
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

// Performance timer
function getElapsedTime(start) {
  return Number(process.hrtime.bigint() - start) / 1e6;
}

// LOGIN
exports.login = async (req, res) => {
  const totalStart = process.hrtime.bigint();

  try {
    const { username, password } = req.body || {};

    // Input validation
    if (
      typeof username !== "string" ||
      typeof password !== "string" ||
      !username.trim() ||
      !password ||
      username.length > 254 ||
      password.length > 1024
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid username and password are required.",
      });
    }

    const cleanUsername = username.trim();

    // Database lookup
    const dbStart = process.hrtime.bigint();

    const result = await pool.query(
      `SELECT
        id,
        full_name,
        username,
        email,
        password_hash,
        role,
        is_active
       FROM users
       WHERE username = $1 OR email = $1
       LIMIT 1`,
      [cleanUsername]
    );

    const dbTime = getElapsedTime(dbStart);

    const user = result.rows[0];

    if (!user || !user.is_active) {
      return res.status(401).json({
        success: false,
        message: "Invalid username or password.",
      });
    }

    // Password verification
    const bcryptStart = process.hrtime.bigint();

    const passwordMatch = await bcrypt.compare(
      password,
      user.password_hash
    );

    const bcryptTime = getElapsedTime(bcryptStart);

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid username or password.",
      });
    }

    // Prevent session fixation
    const sessionStart = process.hrtime.bigint();

    await regenerateSession(req);

    // Store safe user information only
    req.session.user = {
      id: user.id,
      fullName: user.full_name,
      username: user.username,
      email: user.email,
      role: user.role,
    };

    // Save session before responding
    await saveSession(req);

    const sessionTime = getElapsedTime(sessionStart);
    const totalTime = getElapsedTime(totalStart);

    console.log(
      `[AUTH PERFORMANCE] Database: ${dbTime.toFixed(2)} ms | ` +
      `Password: ${bcryptTime.toFixed(2)} ms | ` +
      `Session: ${sessionTime.toFixed(2)} ms | ` +
      `Total: ${totalTime.toFixed(2)} ms`
    );

    return res.json({
      success: true,
      message: "Login successful.",
      user: req.session.user,
    });

  } catch (error) {
    console.error("Login error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Login failed due to a server error.",
    });
  }
};

// CHECK CURRENT USER
exports.me = (req, res) => {
  if (!req.session?.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required.",
    });
  }

  return res.json({
    success: true,
    user: req.session.user,
  });
};

// LOGOUT
exports.logout = (req, res) => {
  req.session.destroy((error) => {
    if (error) {
      console.error("Logout error:", error.message);

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

    return res.json({
      success: true,
      message: "Logged out successfully.",
    });
  });
};
