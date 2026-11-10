const express = require("express");
const authenticate = require("../../middleware/authenticate");
const controller = require("./dashboardController");

const router = express.Router();
router.use(authenticate);
router.get("/summary", controller.summary);
router.get("/sales-chart", controller.salesChart);
router.get("/low-stock", controller.lowStock);

module.exports = router;
