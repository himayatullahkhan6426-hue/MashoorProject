const express = require("express");
const { rateLimit } = require("express-rate-limit");

const {
  login,
  me,
  logout,
} = require("../controllers/authController");

const requireAuth = require("../middleware/authMiddleware");

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many login attempts. Try again later.",
  },
});

router.post("/login", loginLimiter, login);
router.get("/me", requireAuth, me);
router.post("/logout", requireAuth, logout);

module.exports = router;