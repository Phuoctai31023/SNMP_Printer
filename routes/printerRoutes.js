const express = require("express");
const router = express.Router();
const printer = require("../controllers/printerController");

router.get("/", printer.getAllPrinters);
router.post("/add", printer.addPrinter);
router.post("/snmp-update-all", printer.snmpUpdateAll);

module.exports = router;
