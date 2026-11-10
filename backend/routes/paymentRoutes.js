const express = require("express");
const router = express.Router();

const requireAuth = require("../middleware/authMiddleware");
const {
  createPayment,
} = require("../controllers/paymentController");

router.use(requireAuth);

router.post("/shops/:id", createPayment);

module.exports = router;