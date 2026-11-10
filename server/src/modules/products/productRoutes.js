const express = require("express");
const controller = require("./productController");
const stockController = require("./stockController");
const validateObjectId = require("../../utils/validateObjectId");
const authenticate = require("../../middleware/authenticate");

const router = express.Router();

router.use(authenticate);
router.get("/", controller.list);
router.post("/", controller.create);
router.post("/:id/stock", validateObjectId("id"), stockController.change);
router.get("/:id", validateObjectId("id"), controller.get);
router.put("/:id", validateObjectId("id"), controller.update);
router.delete("/:id", validateObjectId("id"), controller.remove);

module.exports = router;
