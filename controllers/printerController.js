const jwt = require("jsonwebtoken");
const Printer = require("../models/printer");
const Department = require("../models/department");
const { getPrinterData } = require("../snmp/snmpReader");
const { sendAlertEmailIfNeeded } = require("../utils/mailer");

async function updateAllPrinters() {
  const printers = await Printer.find().populate("dpm_ID", "name");
  await Promise.allSettled(
    printers.map(async (printer) => {
      try {
        const data = await getPrinterData(printer.ip_address);
        printer.set(data);
        printer.lastSnmpUpdate = new Date();
        await printer.save();

        if (["warning", "error"].includes(data.conditionSeverity)) {
          await sendAlertEmailIfNeeded(
            printer,
            data.conditionSeverity,
            data.condition
          );
        }
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
    let printers = await Printer.find(query).populate("dpm_ID", "name").lean();
    const departments = await Department.find().lean();
    const lastDoc = await Printer.findOne(query)
      .sort({ lastSnmpUpdate: -1 })
      .select("lastSnmpUpdate")
      .lean();
    const lastUpdate = lastDoc ? lastDoc.lastSnmpUpdate : null;

    // gắn publicLink
    printers = printers.map((p) => {
      if (process.env.PUBLIC_LINK_SECRET) {
        const token = jwt.sign({}, process.env.PUBLIC_LINK_SECRET, {
          expiresIn: process.env.PUBLIC_LINK_TTL || "24h",
        });
        p.publicLink = `/printer-detail/${p._id}?token=${token}`;
      }
      return p;
    });

    res.render("dashboard", {
      printers,
      departments,
      user: req.session.user,
      error,
      success,
      lastUpdate,
    });
  } catch (err) {
    console.error("Error rendering dashboard:", err);
    res.status(500).send("Lỗi load dashboard");
  }
};

function isValidIP(ip) {
  const ipRegex =
    /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
  return ipRegex.test(ip);
}

exports.addPrinter = async (req, res) => {
  try {
    const { ip_address, dpm_ID } = req.body;

    if (!isValidIP(ip_address)) {
      return res.redirect(
        "/printers?error=" + encodeURIComponent("Địa chỉ IP không hợp lệ")
      );
    }

    const existing = await Printer.findOne({ ip_address });
    if (existing) {
      return res.redirect(
        "/printers?error=" + encodeURIComponent(`IP ${ip_address} đã tồn tại`)
      );
    }

    const printer = new Printer({ ip_address, dpm_ID });
    await printer.save();

    res.redirect(
      "/printers?success=" + encodeURIComponent("Thêm máy in thành công")
    );
  } catch (err) {
    console.error("Error adding printer:", err);
    res.redirect(
      "/printers?error=" + encodeURIComponent("Thêm máy in thất bại")
    );
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

    if (!isValidIP(ip_address)) {
      return res.redirect(
        "/printers?error=" + encodeURIComponent("Địa chỉ IP không hợp lệ")
      );
    }

    const existing = await Printer.findOne({
      ip_address,
      _id: { $ne: id },
    });
    if (existing) {
      return res.redirect(
        "/printers?error=" + encodeURIComponent(`IP ${ip_address} đã tồn tại`)
      );
    }

    await Printer.findByIdAndUpdate(id, { ip_address, dpm_ID });
    res.redirect(
      "/printers?success=" + encodeURIComponent("Cập nhật máy in thành công")
    );
  } catch (err) {
    console.error("Error updating printer:", err);
    res.redirect(
      "/printers?error=" + encodeURIComponent("Cập nhật máy in thất bại")
    );
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

//Route chi tiết khi login (dashboard)
exports.getPrinterDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const printer = await Printer.findById(id)
      .populate("dpm_ID", "name")
      .lean();
    if (!printer) {
      return res.status(404).send("Không tìm thấy máy in");
    }

    const printers = await Printer.find().select("ip_address").lean();

    res.render("printerDetail", {
      printer,
      printers,
      user: req.session.user, // có user → hiện offcanvas
      token: null,
    });
  } catch (err) {
    console.error("Error loading printer detail (auth):", err);
    res.status(500).send("Lỗi khi tải chi tiết máy in");
  }
};

// Route chi tiết khi public link (email)
// Route chi tiết khi public link (email)
exports.getPrinterDetailPublic = async (req, res) => {
  try {
    const { id } = req.params;
    const token = req.query.token;

    if (!process.env.PUBLIC_LINK_SECRET) {
      return res.status(403).send("Access denied: public links are disabled");
    }
    if (!token) {
      return res.status(403).send("Access denied: missing token");
    }

    try {
      jwt.verify(token, process.env.PUBLIC_LINK_SECRET);
    } catch (e) {
      return res.status(403).send("Access denied: invalid or expired token");
    }

    const printer = await Printer.findById(id)
      .populate("dpm_ID", "name")
      .lean();
    if (!printer) {
      return res.status(404).send("Không tìm thấy máy in");
    }

    // ở chế độ public → không cần danh sách printers để render offcanvas
    res.render("printerDetail", {
      printer,
      printers: [],
      user: null,
      token,
    });
  } catch (err) {
    console.error("Error loading printer detail (public):", err);
    res.status(500).send("Lỗi khi tải chi tiết máy in");
  }
};
