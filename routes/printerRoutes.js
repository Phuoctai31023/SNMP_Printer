const express = require("express");
const router = express.Router();
const printer = require("../controllers/printerController");
const { isAuthenticated, isAdmin } = require("../middlewares/auth");

router.get("/", printer.getAllPrinters);

router.post("/add", isAdmin, printer.addPrinter);
router.post("/snmp-update-all", isAuthenticated, printer.snmpUpdateAll);
router.post("/delete/:id", isAdmin, printer.deletePrinter);
router.post("/update/:id", isAdmin, printer.updatePrinter);

module.exports = router;
