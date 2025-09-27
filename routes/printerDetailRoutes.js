const express = require("express");
const router = express.Router();
const printerController = require("../controllers/printerController");

router.get("/:id", printerController.getPrinterDetailPublic);

module.exports = router;
