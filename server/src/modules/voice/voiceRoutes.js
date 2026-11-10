const express = require("express");
const authenticate = require("../../middleware/authenticate");
const { voiceLimiter } = require("../../middleware/rateLimits");
const controller = require("./voiceController");

const router = express.Router();
router.use(authenticate);
router.use(voiceLimiter);
router.post("/transcribe", controller.upload, controller.transcribe);
router.post("/interpret", controller.interpret);
router.post("/process", controller.upload, controller.process);
router.post("/confirm", controller.confirm);
router.post("/cancel", controller.cancel);
router.post("/speak", controller.speak);

module.exports = router;
