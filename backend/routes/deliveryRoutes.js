
const express = require("express");
const router = express.Router();

const requireAuth = require("../middleware/authMiddleware");

const {
  getDeliveryProducts,
  createDelivery,
} = require("../controllers/deliveryController");

router.use(requireAuth);

// Load products for delivery form
router.get("/products", getDeliveryProducts);

// Create delivery for a shop
router.post("/shops/:id", createDelivery);

module.exports = router;
