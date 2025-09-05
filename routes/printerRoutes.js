const express = require("express");
const router = express.Router();
const printer = require("../controllers/printerController");
const { isAuthenticated, isAdmin } = require("../middlewares/auth");

// Ai cũng xem được (miễn đã đăng nhập ở app.js)
router.get("/", printer.getAllPrinters);

// Chỉ admin mới được thao tác
router.post("/add", isAdmin, printer.addPrinter);
router.post("/snmp-update-all", isAuthenticated, printer.snmpUpdateAll);
router.post("/delete/:id", isAdmin, printer.deletePrinter);
router.post("/update/:id", isAdmin, printer.updatePrinter);

module.exports = router;
