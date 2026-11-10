const express = require("express");
const controller = require("./authController");
const authenticate = require("../../middleware/authenticate");
const { authLimiter } = require("../../middleware/rateLimits");

const router = express.Router();

router.post("/register", authLimiter, controller.register);
router.post("/login", authLimiter, controller.login);
router.use(authenticate);
router.get("/me", controller.profile);
router.put("/me", controller.updateProfile);
router.put("/password", controller.changePassword);
router.post("/logout", controller.logout);

module.exports = router;
