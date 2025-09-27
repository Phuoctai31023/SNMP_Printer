// models/printer.js
const mongoose = require("mongoose");

const printerSchema = new mongoose.Schema(
  {
    ip_address: String,
    printer_type: String,
    serial_number: String,
    dpm_ID: { type: mongoose.Schema.Types.ObjectId, ref: "Department" },
    drum_unit: { type: mongoose.Schema.Types.Mixed },
    page_counter: { type: mongoose.Schema.Types.Mixed },
    toner_level: { type: mongoose.Schema.Types.Mixed },
    online: Boolean,
    condition: String, // text hiện trạng
    conditionSeverity: { type: String, default: null },
    conditionBg: { type: String, default: null },
    // lưu thời điểm SNMP cập nhật gần nhất cho mỗi máy in
    lastSnmpUpdate: { type: Date, default: null },

    // lịch sử lỗi
    errorLogs: [
      {
        severity: { type: String },
        condition: { type: String },
        at: { type: Date, default: Date.now },
        notified: { type: Boolean, default: false },
      },
    ],

    // thông tin cảnh báo để điều chế gửi mail
    lastAlertAt: { type: Date, default: null },
    lastAlertSeverity: { type: String, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Printer", printerSchema);
