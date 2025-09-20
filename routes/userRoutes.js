const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");

router.get("/", userController.listUsers);
router.post("/add", userController.addUser);
router.post("/update/:id", userController.updateUser);
router.post("/delete/:id", userController.deleteUser);
router.post("/toggle-block/:id", userController.toggleBlockUser);

module.exports = router;
