
const express = require("express");
const router = express.Router();

const requireAuth = require("../middleware/authMiddleware");
const {
  getDashboard,
} = require("../controllers/dashboardController");

router.use(requireAuth);

router.get("/", getDashboard);

module.exports = router;
