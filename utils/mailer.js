// utils/mailer.js
const nodemailer = require("nodemailer");
const jwt = require("jsonwebtoken");
const Department = require("../models/department");
const User = require("../models/user");

const ALERT_COOLDOWN_MINUTES = parseInt(
  process.env.ALERT_COOLDOWN_MINUTES || "60",
  10
);

const PUBLIC_SECRET = process.env.PUBLIC_LINK_SECRET || "";
const PUBLIC_BASE_RAW = process.env.PUBLIC_BASE_URL || "http://localhost:3000";
const PUBLIC_TTL = process.env.PUBLIC_LINK_TTL || "24h";

// chuẩn hoá PUBLIC_BASE (bỏ slash cuối nếu có)
const PUBLIC_BASE = PUBLIC_BASE_RAW.replace(/\/$/, "");

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
  console.warn("⚠ SMTP not configured. Alert emails will not be sent.");
}

// Tạo public link có token; nếu không có SECRET -> fallback về link nội bộ (yêu cầu login)
function createPublicLink(printerId) {
  if (!PUBLIC_SECRET) {
    console.warn(
      "PUBLIC_LINK_SECRET not set — fallback to internal link (login required)"
    );
    return `${PUBLIC_BASE}/printers/${printerId}/detail`;
  }
  const token = jwt.sign({ printerId: String(printerId) }, PUBLIC_SECRET, {
    expiresIn: PUBLIC_TTL,
  });
  // đồng bộ URL public với app.js
  return `${PUBLIC_BASE}/printer-detail/${printerId}?token=${encodeURIComponent(
    token
  )}`;
}

async function sendAlertEmailIfNeeded(printerDoc, severity, conditionText) {
  try {
    if (!transporter)
      return console.log("Skipping send mail: transporter not configured");

    // kiểm tra cooldown
    if (printerDoc.lastAlertSeverity === severity && printerDoc.lastAlertAt) {
      const diffMin =
        (Date.now() - new Date(printerDoc.lastAlertAt).getTime()) / 60000;
      if (diffMin < ALERT_COOLDOWN_MINUTES) {
        console.log(
          `Skip alert for ${
            printerDoc.ip_address
          }: within cooldown (${Math.round(diffMin)} min)`
        );
        return;
      }
    }

    // kiểm tra bộ phận
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

    // lấy tên bộ phận
    let deptName = "Không xác định";
    if (typeof printerDoc.dpm_ID === "object" && printerDoc.dpm_ID.name) {
      deptName = printerDoc.dpm_ID.name;
    } else {
      try {
        const d = await Department.findById(deptId).select("name").lean();
        if (d && d.name) deptName = d.name;
      } catch (e) {
        console.warn(
          "Failed to load department name for id",
          deptId,
          e?.message
        );
      }
    }

    // tìm user trong bộ phận có email
    const users = await User.find({ department: deptId, email: { $ne: null } })
      .select("email username")
      .lean();
    const toEmails = [...new Set(users.map((u) => u.email).filter(Boolean))];
    if (!toEmails.length) {
      console.log(`No emails found for department ${deptName}`);
      return;
    }

    // subject + severity
    const subjectPrefix = severity === "error" ? "[CRITICAL]" : "[WARNING]";
    const severityColor = severity === "error" ? "#c0392b" : "#e67e22";
    const severityLabel = severity === "error" ? "NGHIÊM TRỌNG" : "CẢNH BÁO";
    const subject = `${subjectPrefix} Máy in ${printerDoc.ip_address} (${
      conditionText || "Trạng thái lạ"
    })`;

    // tạo public link có token
    const publicLink = createPublicLink(printerDoc._id);

    // HTML email (responsive, cân đối)
    const html = `
  <div style="margin:0; padding:0; background:#f4f6f8; font-family:Segoe UI, Roboto, Arial, sans-serif; color:#2c3e50;">
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td align="center" style="padding:24px 12px;">
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" 
                 style="max-width:700px; background:#ffffff; border:1px solid #e6e9ee; border-radius:10px; overflow:hidden; box-shadow:0 6px 18px rgba(18,38,63,0.06);">
            
            <!-- Header -->
            <tr>
              <td align="center" style="padding:28px 22px; border-bottom:4px solid ${severityColor}; background:#fff;">
                <img src="cid:companyLogo" alt="Company Logo" style="max-width:160px; height:auto; margin-bottom:10px; display:block;" />
                <h1 style="color:#2c3e50; font-size:20px; margin:6px 0 0; font-weight:600;">HỆ THỐNG GIÁM SÁT MÁY IN</h1>
                <p style="font-size:13px; margin:6px 0 0; color:#7f8c8d; font-style:italic;">Silk Sense Hội An River Resort</p>
              </td>
            </tr>

            <!-- Banner -->
            <tr>
              <td align="center" style="background:${severityColor}; padding:14px;">
                <span style="color:#ffffff; font-size:16px; font-weight:700;">🚨 ${severityLabel} – Sự cố máy in</span>
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td style="padding:22px; line-height:1.6;">
                <p style="margin:0 0 10px;">Kính gửi Quý bộ phận <strong>${deptName}</strong>,</p>
                <p style="margin:0 0 18px;">Hệ thống vừa phát hiện sự cố trên máy in. Dưới đây là chi tiết:</p>

                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" 
                       style="border:1px solid #e6e9ee; border-radius:6px; font-size:14px; margin-bottom:20px;">
                  <tr style="background:#fbfdff;">
                    <td style="padding:12px; font-weight:600; width:36%;">Bộ phận</td>
                    <td style="padding:12px;">${deptName}</td>
                  </tr>
                  <tr>
                    <td style="padding:12px; font-weight:600;">Địa chỉ IP</td>
                    <td style="padding:12px;">${printerDoc.ip_address}</td>
                  </tr>
                  <tr style="background:#fbfdff;">
                    <td style="padding:12px; font-weight:600;">Trạng thái</td>
                    <td style="padding:12px; color:${severityColor}; font-weight:700;">${conditionText}</td>
                  </tr>
                  <tr>
                    <td style="padding:12px; font-weight:600;">Mức độ</td>
                    <td style="padding:12px;">${severity.toUpperCase()}</td>
                  </tr>
                  <tr style="background:#fbfdff;">
                    <td style="padding:12px; font-weight:600;">Thời gian</td>
                    <td style="padding:12px;">${new Date().toLocaleString(
                      "vi-VN"
                    )}</td>
                  </tr>
                </table>

                <div style="text-align:center; margin:18px 0;">
                  <a href="${publicLink}" 
                     style="background:${severityColor}; color:#ffffff; text-decoration:none; padding:12px 26px; border-radius:6px; font-size:15px; font-weight:700; display:inline-block;">
                    🔎 Xem chi tiết trên hệ thống
                  </a>
                </div>

                <p style="margin:0; color:#5b6a74;">Vui lòng xử lý sự cố hoặc liên hệ bộ phận IT để được hỗ trợ ngay.</p>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="background:#fbfdff; padding:18px; text-align:center; font-size:12px; color:#7f8c8d;">
                <p style="margin:6px 0;">Đây là email tự động từ hệ thống giám sát máy in <strong>Silk Sense Hội An River Resort</strong>.</p>
                <p style="margin:6px 0;">☎ Hotline IT: +84 905 418 198 | ✉ it.staff@silksenseresort.com</p>
                <p style="margin:6px 0;">© ${new Date().getFullYear()} Silk Sense Hội An River Resort. All Rights Reserved.</p>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </div>
`;

    // Prepare mailOptions
    const mailOptions = {
      from: process.env.FROM_EMAIL || process.env.SMTP_USER,
      to: toEmails.join(","),
      subject,
      html,
      attachments: [
        { filename: "logo.png", path: "public/logo.png", cid: "companyLogo" },
      ],
    };

    // Chuẩn bị log entry (lưu dù gửi mail thành công hay không)
    const logEntry = {
      severity,
      condition: conditionText || printerDoc.condition || "",
      at: new Date(),
      notified: false,
    };

    // Gửi mail (bắt lỗi nhưng dù lỗi vẫn lưu log)
    let mailOk = false;
    try {
      await transporter.sendMail(mailOptions);
      mailOk = true;
      console.log(
        `✅ Alert email sent for ${printerDoc.ip_address} (department: ${deptName}) to ${toEmails.length} recipient(s)`
      );
    } catch (err) {
      console.error("❌ Error sending alert email:", err?.stack || err);
    }

    // cập nhật log vào document và lastAlert nếu mailOk
    if (!Array.isArray(printerDoc.errorLogs)) printerDoc.errorLogs = [];
    logEntry.notified = mailOk;
    printerDoc.errorLogs.push(logEntry);

    // cập nhật lastAlert chỉ khi mail gửi thành công
    if (mailOk) {
      printerDoc.lastAlertAt = new Date();
      printerDoc.lastAlertSeverity = severity;
    }

    await printerDoc.save();
  } catch (err) {
    console.error("❌ Error in sendAlertEmailIfNeeded:", err?.stack || err);
  }
}

module.exports = { sendAlertEmailIfNeeded, createPublicLink };
