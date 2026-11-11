
const express = require("express");
const router = express.Router();

const requireAuth = require("../middleware/authMiddleware");
const { globalSearch } = require("../controllers/searchController");

router.use(requireAuth);

router.get("/", globalSearch);

module.exports = router;
