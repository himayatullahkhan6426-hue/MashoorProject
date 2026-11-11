
const express = require("express");
const router = express.Router();

const {
  sendDailyReport,
} = require("../controllers/dailyReportController");

router.post("/", sendDailyReport);

module.exports = router;
