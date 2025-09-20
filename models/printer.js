// models/printer.js
const mongoose = require("mongoose");

const printerSchema = new mongoose.Schema({
  ip_address: String,
  printer_type: String,
  serial_number: String,
  dpm_ID: { type: mongoose.Schema.Types.ObjectId, ref: "Department" },
  drum_unit: { type: mongoose.Schema.Types.Mixed },
  page_counter: { type: mongoose.Schema.Types.Mixed },
  toner_level: { type: mongoose.Schema.Types.Mixed },
  online: Boolean,
  condition: String,
  // lưu thời điểm SNMP cập nhật gần nhất cho mỗi máy in
  lastSnmpUpdate: { type: Date, default: null },
});

module.exports = mongoose.model("Printer", printerSchema);
