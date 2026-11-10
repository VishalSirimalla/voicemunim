const express = require("express");
const controller = require("./saleController");
const validateObjectId = require("../../utils/validateObjectId");
const authenticate = require("../../middleware/authenticate");

const router = express.Router();

router.use(authenticate);
router.get("/", controller.list);
router.post("/", controller.create);
router.get("/:id", validateObjectId("id"), controller.get);

module.exports = router;
