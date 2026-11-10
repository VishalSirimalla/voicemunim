const express = require("express");
const controller = require("./customerController");
const validateObjectId = require("../../utils/validateObjectId");
const authenticate = require("../../middleware/authenticate");

const router = express.Router();

router.use(authenticate);
router.get("/", controller.list);
router.post("/", controller.create);
router.get("/:id/ledger", validateObjectId("id"), controller.ledger);
router.get("/:id", validateObjectId("id"), controller.get);
router.put("/:id", validateObjectId("id"), controller.update);

module.exports = router;
