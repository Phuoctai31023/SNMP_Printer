const Printer = require("../models/printer");
const { getPrinterData } = require("../snmp/snmpReader");
exports.getAllPrinters = async (req, res) => {
  const { dpm_ID, error } = req.query;
  const query = dpm_ID ? { dpm_ID } : {};
  const printers = await Printer.find(query);
  res.render("dashboard", { printers, user: req.session.user, error });
};

exports.addPrinter = async (req, res) => {
  try {
    const { ip_address, dpm_ID } = req.body;
    const existing = await Printer.findOne({ ip_address });
    if (existing) {
      return res.redirect(`/printers?error=IP ${ip_address} đã tồn tại`);
    }

    const printer = new Printer({ ip_address, dpm_ID });
    await printer.save();
    res.redirect("/dashboard");
  } catch (err) {
    console.error("Error adding printer:", err);
    res.status(500).send("❌ Lỗi khi thêm máy in");
  }
};

exports.snmpUpdateAll = async (req, res) => {
  try {
    const printers = await Printer.find();
    for (const printer of printers) {
      try {
        const data = await getPrinterData(printer.ip_address);
        Object.assign(printer, data);
        await printer.save();
      } catch (err) {
        console.error(`SNMP update failed for ${printer.ip_address}:`, err);
      }
    }
    res.redirect("/printers?success=Cập nhật SNMP thành công");
  } catch (err) {
    console.error("SNMP update all failed:", err);
    res.redirect("/printers?error=Cập nhật SNMP thất bại");
  }
};
