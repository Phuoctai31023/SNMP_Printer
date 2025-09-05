const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");

// Danh sách users
router.get("/", userController.listUsers);

// Thêm user
router.post("/add", userController.addUser);

// Sửa user
router.post("/update/:id", userController.updateUser);

// Xóa user
router.post("/delete/:id", userController.deleteUser);

module.exports = router;
