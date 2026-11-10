const express = require("express");
const authenticate = require("../../middleware/authenticate");
const controller = require("./reportController");

const router = express.Router();
router.use(authenticate);
router.get("/daily", controller.daily);
router.get("/sales", controller.sales);
router.get("/collections", controller.collections);
router.get("/outstanding", controller.outstanding);
router.get("/inventory", controller.inventory);
router.get("/top-products", controller.top);
router.get("/low-stock", controller.lowStock);

module.exports = router;
