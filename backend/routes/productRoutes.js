const express = require("express");
const router = express.Router();

const requireAuth = require("../middleware/authMiddleware");

const {
  getProducts,
  createProduct,
  updateProduct,
  deactivateProduct,
} = require("../controllers/productController");

router.use(requireAuth);

router.get("/", getProducts);
router.post("/", createProduct);
router.put("/:id", updateProduct);
router.patch("/:id/deactivate", deactivateProduct);

module.exports = router;