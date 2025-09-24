const Printer = require("../models/printer");
const Department = require("../models/department");
const User = require("../models/user");
const { getPrinterData } = require("../snmp/snmpReader");
const nodemailer = require("nodemailer");

const ALERT_COOLDOWN_MINUTES = parseInt(
  process.env.ALERT_COOLDOWN_MINUTES || "60",
  10
);

// tạo transporter nodemailer
let transporter = null;
if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || "587", 10),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
} else {
  console.warn(
    "SMTP not configured. Alert emails will not be sent. Set SMTP_HOST/SMTP_USER/SMTP_PASS in .env"
  );
}

async function sendAlertEmailIfNeeded(printerDoc, severity, conditionText) {
  try {
    if (!transporter) {
      console.log("Skipping send mail: transporter not configured");
      return;
    }
    if (printerDoc.lastAlertSeverity === severity && printerDoc.lastAlertAt) {
      const diffMin =
        (Date.now() - new Date(printerDoc.lastAlertAt).getTime()) / 60000;
      if (diffMin < ALERT_COOLDOWN_MINUTES) {
        console.log(
          `Skip alert for ${
            printerDoc.ip_address
          }: same severity '${severity}' within cooldown (${Math.round(
            diffMin
          )} min)`
        );
        return;
      }
    }

    if (!printerDoc.dpm_ID) {
      console.log(
        `Printer ${printerDoc.ip_address} has no department assigned, skip alert.`
      );
      return;
    }
    const deptId =
      typeof printerDoc.dpm_ID === "object" && printerDoc.dpm_ID._id
        ? printerDoc.dpm_ID._id
        : printerDoc.dpm_ID;

    // Lấy tên bộ phận
    let deptName = "Không xác định";
    if (typeof printerDoc.dpm_ID === "object" && printerDoc.dpm_ID.name) {
      deptName = printerDoc.dpm_ID.name;
    } else {
      try {
        const d = await Department.findById(deptId).select("name").lean();
        if (d && d.name) deptName = d.name;
      } catch (e) {
        // ignore, dùng 'Không xác định'
        console.warn(
          "Failed to load department name for id",
          deptId,
          e && e.message
        );
      }
    }

    // tìm users của department có email
    const users = await User.find({
      department: deptId,
      email: { $ne: null },
    })
      .select("email username")
      .lean();

    const toEmails = [...new Set(users.map((u) => u.email).filter(Boolean))];

    if (!toEmails || toEmails.length === 0) {
      console.log(
        `No emails found for department ${deptName || deptId} (printer ${
          printerDoc.ip_address
        })`
      );
      return;
    }

    const subjectPrefix = severity === "error" ? "[CRITICAL]" : "[WARNING]";
    const subject = `${subjectPrefix} Máy in ${printerDoc.ip_address} (${
      conditionText || "Trạng thái lạ"
    })`;

    const html = `
      <p>Xin chào,</p>
      <p>Hệ thống phát hiện máy in <strong>${
        printerDoc.ip_address
      }</strong> (Bộ phận: <strong>${deptName}</strong>) có trạng thái: <strong>${conditionText}</strong></p>
      <ul>
        <li>Severity: ${severity}</li>
        <li>IP: ${printerDoc.ip_address}</li>
        <li>Thời gian: ${new Date().toLocaleString()}</li>
      </ul>
      <p>Vui lòng kiểm tra thiết bị hoặc liên hệ trưởng bộ phận.</p>
    `;

    const mailOptions = {
      from: process.env.FROM_EMAIL || process.env.SMTP_USER,
      to: toEmails.join(","),
      subject,
      html,
    };

    await transporter.sendMail(mailOptions);
    console.log(
      `Alert email sent for ${printerDoc.ip_address} (department: ${deptName}) to ${toEmails.length} recipient(s)`
    );

    // cập nhật lastAlertAt & lastAlertSeverity
    printerDoc.lastAlertAt = new Date();
    printerDoc.lastAlertSeverity = severity;
    await printerDoc.save();
  } catch (err) {
    console.error(
      "Error sending alert email:",
      err && err.stack ? err.stack : err
    );
  }
}

async function updateAllPrinters() {
  const printers = await Printer.find().populate("dpm_ID", "name");
  await Promise.allSettled(
    printers.map(async (printer) => {
      try {
        const data = await getPrinterData(printer.ip_address);
        printer.set(data);
        // Ghi lại thời điểm cập nhật SNMP thành công cho từng máy
        printer.lastSnmpUpdate = new Date();

        await printer.save();

        // nếu severity warning hoặc error -> gửi email
        const sev = data.conditionSeverity;
        if (sev === "warning" || sev === "error") {
          // gửi mail cho user thuộc bộ phận máy in đó
          await sendAlertEmailIfNeeded(printer, sev, data.condition);
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

    // Khi render dashboard: populate để hiển thị tên bộ phận
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

    // kiểm tra IP hợp lệ
    if (!isValidIP(ip_address)) {
      return res.redirect(
        "/printers?error=" + encodeURIComponent("Địa chỉ IP không hợp lệ")
      );
    }

    // kiểm tra trùng IP
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

    // kiểm tra trùng IP
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
