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

router.use(requireAuth);

router.get("/", getShops);
router.post("/", createShop);
router.put("/:id", updateShop);
router.patch("/:id/deactivate", deactivateShop);
router.get("/:id/dashboard", getShopDashboard);

module.exports = router;