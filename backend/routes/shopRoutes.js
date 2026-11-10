const express = require("express");
const router = express.Router();

const requireAuth = require("../middleware/authMiddleware");

const {
  getShops,
  createShop,
  updateShop,
  deactivateShop,
} = require("../controllers/shopController");

const {
  getShopDashboard,
} = require("../controllers/shopDashboardController");

const {
  createBalanceAdjustment,
} = require("../controllers/balanceAdjustmentController");

// Protect all shop routes
router.use(requireAuth);

router.get("/", getShops);
router.post("/", createShop);
router.put("/:id", updateShop);
router.patch("/:id/deactivate", deactivateShop);

router.get("/:id/dashboard", getShopDashboard);

// Manual balance adjustment
router.post("/:id/adjustments", createBalanceAdjustment);

module.exports = router;