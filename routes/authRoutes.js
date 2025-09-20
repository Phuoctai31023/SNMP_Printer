const express = require("express");
const router = express.Router();
const auth = require("../controllers/authController");
const { isAuthenticated } = require("../middlewares/auth");

router.get("/login", (req, res) => res.render("login", { error: null }));
router.post("/login", auth.login);

router.get("/change-password", isAuthenticated, auth.getChangePassword);
router.post("/change-password", isAuthenticated, auth.changePassword);

router.get("/logout", auth.logout);

module.exports = router;
