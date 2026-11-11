
const express = require("express");
const { rateLimit } = require("express-rate-limit");

const {
  login,
  me,
  logout,
} = require("../controllers/authController");

const requireAuth = require("../middleware/authMiddleware");

const router = express.Router();

// Login rate limiter
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,

  standardHeaders: true,
  legacyHeaders: false,

  message: {
    success: false,
    message: "Too many login attempts. Try again later.",
  },

  // Avoid unnecessary rate-limit headers on successful requests
  skipSuccessfulRequests: true,
});

// Authentication routes
router.post("/login", loginLimiter, login);

router.get("/me", requireAuth, me);

router.post("/logout", requireAuth, logout);

module.exports = router;
