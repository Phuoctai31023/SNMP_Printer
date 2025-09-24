const Printer = require("../models/printer");
const Department = require("../models/department");
const { getPrinterData } = require("../snmp/snmpReader");

async function updateAllPrinters() {
  const printers = await Printer.find();
  await Promise.allSettled(
    printers.map(async (printer) => {
      try {
        const data = await getPrinterData(printer.ip_address);
        printer.set(data);
        // Ghi lại thời điểm cập nhật SNMP thành công cho từng máy
        printer.lastSnmpUpdate = new Date();

        await printer.save();
      } catch (err) {
        console.error(`SNMP update failed for ${printer.ip_address}:`, err);
      }
    })
  );
}

exports.getAllPrinters = async (req, res) => {
  try {
    await updateAllPrinters();

    const { dpm_ID, error, success } = req.query;
    const query = dpm_ID ? { dpm_ID } : {};

    const printers = await Printer.find(query)
      .populate("dpm_ID", "name")
      .lean();
    const departments = await Department.find().lean();

    // Tính mốc cập nhật gần nhất
    const lastDoc = await Printer.findOne(query)
      .sort({ lastSnmpUpdate: -1 })
      .select("lastSnmpUpdate")
      .lean();
    const lastUpdate =
      lastDoc && lastDoc.lastSnmpUpdate ? lastDoc.lastSnmpUpdate : null;

    res.render("dashboard", {
      printers,
      departments,
      user: req.session.user,
      error,
      success,
      lastUpdate, // truyền mốc server-side
    });
  } catch (err) {
    console.error("Error rendering dashboard:", err);
    res.status(500).send("Lỗi load dashboard");
  }
};

exports.addPrinter = async (req, res) => {
  try {
    const { ip_address, dpm_ID } = req.body;

    // kiểm tra trùng IP
    const existing = await Printer.findOne({ ip_address });
    if (existing) {
      return res.redirect(`/printers?error=IP ${ip_address} đã tồn tại`);
    }

    // thêm mới
    const printer = new Printer({ ip_address, dpm_ID });
    await printer.save();

    // báo thành công
    res.redirect("/printers?success=Thêm máy in thành công");
  } catch (err) {
    console.error("Error adding printer:", err);
    res.redirect("/printers?error=Thêm máy in thất bại");
  }
};

exports.deletePrinter = async (req, res) => {
  try {
    const { id } = req.params;
    await Printer.findByIdAndDelete(id);
    res.redirect("/printers?success=Đã xóa máy in thành công");
  } catch (err) {
    console.error("Error deleting printer:", err);
    res.redirect("/printers?error=Xóa máy in thất bại");
  }
};

exports.updatePrinter = async (req, res) => {
  try {
    const { id } = req.params;
    const { ip_address, dpm_ID } = req.body;

    // kiểm tra trùng IP
    const existing = await Printer.findOne({
      ip_address,
      _id: { $ne: id },
    });
    if (existing) {
      return res.redirect(`/printers?error=IP ${ip_address} đã tồn tại`);
    }

    await Printer.findByIdAndUpdate(id, { ip_address, dpm_ID });
    res.redirect("/printers?success=Cập nhật máy in thành công");
  } catch (err) {
    console.error("Error updating printer:", err);
    res.redirect("/printers?error=Cập nhật máy in thất bại");
  }
};

exports.snmpUpdateAll = async (req, res) => {
  try {
    await updateAllPrinters();
    res.redirect("/printers?success=Cập nhật SNMP thành công");
  } catch (err) {
    console.error("SNMP update all failed:", err);
    res.redirect("/printers?error=Cập nhật SNMP thất bại");
  }
};
