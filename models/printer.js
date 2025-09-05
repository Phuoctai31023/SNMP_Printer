const mongoose = require("mongoose");

const printerSchema = new mongoose.Schema({
  ip_address: String,
  printer_type: String,
  serial_number: String,
  dpm_ID: String,
  drum_unit: { type: mongoose.Schema.Types.Mixed },
  page_counter: { type: mongoose.Schema.Types.Mixed },
  toner_level: { type: mongoose.Schema.Types.Mixed },
  online: Boolean,
  condition: String,
});

module.exports = mongoose.model("Printer", printerSchema);
