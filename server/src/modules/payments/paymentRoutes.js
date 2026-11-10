const express = require("express");
const controller = require("./paymentController");
const authenticate = require("../../middleware/authenticate");

const router = express.Router();
router.use(authenticate);
router.post("/", controller.create);

module.exports = router;
