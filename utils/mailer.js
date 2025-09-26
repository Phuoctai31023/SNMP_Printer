const nodemailer = require("nodemailer");
const Department = require("../models/department");
const User = require("../models/user");

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
  console.warn("⚠ SMTP not configured. Alert emails will not be sent.");
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

    // HTML email
    const html = `
      <div style="margin:0; padding:0; background:#f4f6f8; font-family:Segoe UI, Roboto, Arial, sans-serif; color:#2c3e50;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td align="center" style="padding:30px 15px;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" 
                     style="max-width:650px; background:#ffffff; border:1px solid #e1e5eb; border-radius:10px; overflow:hidden; box-shadow:0 4px 12px rgba(0,0,0,0.08);">
                
                <!-- Header -->
                <tr>
                  <td align="center" style="padding:25px; border-bottom:3px solid ${severityColor}; background:#ffffff;">
                    <img src="cid:companyLogo" alt="Company Logo" style="max-width:160px; margin-bottom:10px;" />
                    <h1 style="color:#2c3e50; font-size:20px; margin:8px 0 0;">HỆ THỐNG GIÁM SÁT MÁY IN</h1>
                    <p style="font-size:13px; margin:4px 0 0; color:#7f8c8d; font-style:italic;">Silk Sense Hội An River Resort</p>
                  </td>
                </tr>

                <!-- Alert -->
                <tr>
                  <td align="center" style="background:${severityColor}; padding:16px;">
                    <span style="color:#ffffff; font-size:16px; font-weight:bold;">🚨 ${severityLabel} – Sự cố máy in</span>
                  </td>
                </tr>

                <!-- Body -->
                <tr>
                  <td style="padding:25px;">
                    <p>Kính gửi Quý bộ phận <strong>${deptName}</strong>,</p>
                    <p>Hệ thống vừa phát hiện sự cố trên máy in. Dưới đây là chi tiết:</p>

                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" 
                           style="border:1px solid #e1e5eb; border-radius:6px; font-size:14px;">
                      <tr style="background:#f9fafc;">
                        <td style="padding:10px; font-weight:600; width:35%;">Bộ phận</td>
                        <td style="padding:10px;">${deptName}</td>
                      </tr>
                      <tr>
                        <td style="padding:10px; font-weight:600;">Địa chỉ IP</td>
                        <td style="padding:10px;">${printerDoc.ip_address}</td>
                      </tr>
                      <tr style="background:#f9fafc;">
                        <td style="padding:10px; font-weight:600;">Trạng thái</td>
                        <td style="padding:10px; color:${severityColor}; font-weight:bold;">${conditionText}</td>
                      </tr>
                      <tr>
                        <td style="padding:10px; font-weight:600;">Mức độ</td>
                        <td style="padding:10px;">${severity.toUpperCase()}</td>
                      </tr>
                      <tr style="background:#f9fafc;">
                        <td style="padding:10px; font-weight:600;">Thời gian</td>
                        <td style="padding:10px;">${new Date().toLocaleString(
                          "vi-VN"
                        )}</td>
                      </tr>
                    </table>

                    <div style="text-align:center; margin:28px 0;">
                      <a href="http://localhost:3000/printers" 
                         style="background:${severityColor}; color:#fff; padding:14px 28px; border-radius:6px; font-weight:600; text-decoration:none;">
                        🔎 Xem chi tiết trên hệ thống
                      </a>
                    </div>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="background:#f9fafc; padding:20px; text-align:center; font-size:12px; color:#7f8c8d;">
                    <p>Đây là email tự động từ hệ thống giám sát máy in <strong>Silk Sense Hội An River Resort</strong>.</p>
                    <p>☎ Hotline IT: +84 123 456 789 | ✉ it.support@silksenseresort.com</p>
                    <p>© ${new Date().getFullYear()} Silk Sense Hội An River Resort. All Rights Reserved.</p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </div>
    `;

    // gửi mail
    const mailOptions = {
      from: process.env.FROM_EMAIL || process.env.SMTP_USER,
      to: toEmails.join(","),
      subject,
      html,
      attachments: [
        { filename: "logo.png", path: "public/logo.png", cid: "companyLogo" },
      ],
    };

    await transporter.sendMail(mailOptions);
    console.log(
      `✅ Alert email sent for ${printerDoc.ip_address} (${deptName}) to ${toEmails.length} recipient(s)`
    );

    printerDoc.lastAlertAt = new Date();
    printerDoc.lastAlertSeverity = severity;
    await printerDoc.save();
  } catch (err) {
    console.error("❌ Error sending alert email:", err?.stack || err);
  }
}

module.exports = { sendAlertEmailIfNeeded };
