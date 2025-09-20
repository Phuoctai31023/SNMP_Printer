const express = require("express");
const router = express.Router();
const departmentController = require("../controllers/departmentController");
const { isAuthenticated, isAdmin } = require("../middlewares/auth");

// Chỉ admin mới có quyền quản lý bộ phận
router.get("/", isAuthenticated, isAdmin, departmentController.listDepartments);
router.post(
  "/add",
  isAuthenticated,
  isAdmin,
  departmentController.addDepartment
);
router.post(
  "/update/:id",
  isAuthenticated,
  isAdmin,
  departmentController.updateDepartment
);
router.post(
  "/delete/:id",
  isAuthenticated,
  isAdmin,
  departmentController.deleteDepartment
);

module.exports = router;
