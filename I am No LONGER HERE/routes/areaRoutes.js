const express = require("express");
const router = express.Router();

const requireAuth = require("../middleware/authMiddleware");

const {
  getAreas,
  createArea,
  updateArea,
  deactivateArea,
} = require("../controllers/areaController");

router.use(requireAuth);

router.get("/", getAreas);
router.post("/", createArea);
router.put("/:id", updateArea);
router.patch("/:id/deactivate", deactivateArea);

module.exports = router;