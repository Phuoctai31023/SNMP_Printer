# SNMP_Printer — HƯỚNG DẪN CÀI ĐẶT VÀ SỬ DỤNG (Chi tiết)

> Tài liệu này là README chi tiết để có thể cài đặt, cấu hình, kiểm tra và vận hành hệ thống **SNMP_Printer**.

---

## Mục lục

1. Yêu cầu trước khi cài
2. Tải code & cài đặt
3. Cấu hình (.env) — ví dụ & giải thích trường
4. Cấu hình SMTP (Gmail / Outlook / Yahoo / SMTP nội bộ)
5. Cấu hình Public Link (SECRET / BASE_URL / TTL)
6. Chạy ứng dụng & quản lý tiến trình
7. Kiểm tra (Test) — gửi mail & tạo public link
8. Thay đổi (tùy chỉnh) `mailer.js` — nội dung email, logo, người nhận
9. Backup/Restore database (mongodump, mongorestore, Compass)
10. Troubleshooting các lỗi thường gặp
11. Bảo mật & best-practices
12. FAQ ngắn
13. Liên hệ / Ghi chú

---

# 1. Yêu cầu trước khi cài

- Node.js LTS (18.x hoặc 20.x). Tải: [https://nodejs.org/](https://nodejs.org/)
- Git (nếu muốn clone từ GitHub). Tải: [https://git-scm.com/downloads](https://git-scm.com/downloads)
- MongoDB (Community Server) — chạy local hoặc remote (URI dạng `mongodb://...`).
- Kết nối mạng LAN/WiFi nếu muốn đọc SNMP từ máy in.
- (Tuỳ chọn) PM2 để chạy service trên server: `npm i -g pm2`.

---

# 2. Tải code & cài đặt

```bash
# Clone repo
git clone https://github.com/Phuoctai31023/SNMP_Printer.git
cd SNMP_Printer

# Cài dependency
npm install
```

> **Lưu ý:** trước khi chạy, tạo file `.env` theo phần 3.

---

# 3. File cấu hình `.env` — mẫu & giải thích

Tạo file `.env` ở root của dự án (không commit file này vào git). Thêm `.env` vào `.gitignore`.

# MongoDB

MONGO_URI=mongodb://localhost:27017/qlPrinter
SESSION_SECRET=mysecret

# SMTP (ví dụ Gmail)

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=you@example.com
SMTP_PASS=the_app_password_here
FROM_EMAIL=you@example.com

# Public link (tokenized link gửi trong email)

PUBLIC_LINK_SECRET=replace_with_a_long_random_hex_string
PUBLIC_BASE_URL=http://localhost:3000
PUBLIC_LINK_TTL=24h

# Thời gian giữa 2 lần gửi mail cảnh báo (phút)

ALERT_COOLDOWN_MINUTES=60

```

**Giải thích trường quan trọng:**

- `MONGO_URI`: đường dẫn MongoDB (có thể là `mongodb://user:pass@host:port/dbname`).
- `SMTP_*`: cấu hình server email (host/port/secure/user/pass). `SMTP_PASS` nên là _App Password_ nếu dùng Gmail/Microsoft.
- `FROM_EMAIL`: email hiển thị trong trường From. Có thể viết dạng `"Company Name" <no-reply@example.com>`.
- `PUBLIC_LINK_SECRET`: chuỗi bí mật để ký JWT cho public link. **Rất quan trọng — không chia sẻ công khai.**
- `PUBLIC_BASE_URL`: base URL người nhận click. Nếu chạy trên LAN, đặt IP máy chủ: `http://192.168.1.100:3000`.
- `PUBLIC_LINK_TTL`: thời hạn hợp lệ cho public link (ví dụ `24h`, `7d`, `60m`).
- `ALERT_COOLDOWN_MINUTES`: để tránh spam mail, nếu cùng severity đã gửi trong khoảng này thì sẽ bỏ qua.

---

# 4. Cấu hình SMTP chi tiết (Gmail / Outlook / Yahoo / SMTP nội bộ)

> **Nguyên tắc chung:** `mailer.js` tự khởi tạo transporter từ `process.env.SMTP_HOST/SMTP_USER/SMTP_PASS` — bạn chỉ cần sửa `.env`.

## 4.1 Gmail (Google Account)

1. Bật **2-Step Verification** trong Google Account → Security.
2. Vào **App passwords** → chọn app = Mail, device = Other → đặt tên `SNMP_Printer` → Generate.
3. Copy 16 ký tự App password và đặt vào `SMTP_PASS`.

`.env` mẫu:

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=youremail@gmail.com
SMTP_PASS=16char_app_password
FROM_EMAIL="Tên Công Ty" <youremail@gmail.com>
```

> Nếu không thể tạo App password (ví dụ Google Workspace bị admin chặn), liên hệ admin.

## 4.2 Outlook / Microsoft 365

1. Bật Two-step verification trong Microsoft Account.
2. Tạo **App password** (nếu chính sách cho phép).

`.env` mẫu:

SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=you@yourcompany.com
SMTP_PASS=app_password
FROM_EMAIL=you@yourcompany.com

```

## 4.3 Yahoo

SMTP_HOST=smtp.mail.yahoo.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=you@yahoo.com
SMTP_PASS=app_password
FROM_EMAIL=you@yahoo.com
```

## 4.4 SMTP nội bộ công ty

Hỏi IT thông tin: host, port, secure (TLS/SSL), user/pass. Điền vào `.env` tương tự.

---

# 5. Cấu hình Public Link (chi tiết)

Public link cho phép người nhận email click vào để xem chi tiết máy in mà **không cần đăng nhập** — link chứa token JWT có thời hạn.

## 5.1 Tạo `PUBLIC_LINK_SECRET` mạnh

Sử dụng Node hoặc OpenSSL:

```bash
# Node
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

# hoặc OpenSSL
openssl rand -hex 48
```

Copy kết quả và dán vào `PUBLIC_LINK_SECRET` trong `.env`.

> **Chú ý:** nếu đổi secret này, tất cả link đã phát hành trước đó sẽ không còn hợp lệ.

## 5.2 Chọn `PUBLIC_BASE_URL`

- Local dev: `http://localhost:3000`
- LAN: `http://192.168.1.100:3000` (thay IP bằng IP máy chủ)
- Public: `https://example.com` (nên dùng HTTPS nếu public)

## 5.3 `PUBLIC_LINK_TTL`

- Hỗ trợ: `24h`, `7d`, `60m`, hoặc số giây như `3600`.
- Ghi vào `.env`.

---

# 6. Chạy ứng dụng & quản lý tiến trình

### 6.1 Chạy trực tiếp

```bash
node app.js
# hoặc
npm start
```

Mở trình duyệt: `http://localhost:3000/printers` (hoặc `PUBLIC_BASE_URL` bạn cấu hình).

### 6.2 Chạy ở chế độ phát triển (hot reload)

Cài `nodemon` nếu muốn:

```bash
npm i -g nodemon
nodemon app.js
```

### 6.3 Chạy production với PM2

```bash
pm i -g pm2
pm2 start app.js --name snmp_printer
pm2 save
pm2 logs snmp_printer
```

---

# 7. Kiểm tra (Test)

Mình cung cấp 2 script test để bạn copy vào root repo và chạy.

## 7.1 Test gửi mail — `test-mail.js`

Tạo file `test-mail.js`:

```js
require("dotenv").config();
const nodemailer = require("nodemailer");

async function run() {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || "587", 10),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });

  try {
    const info = await transporter.sendMail({
      from: process.env.FROM_EMAIL || process.env.SMTP_USER,
      to: process.env.SMTP_USER,
      subject: "Test email từ SNMP_Printer",
      text: "Đây là email thử nghiệm từ SNMP_Printer",
      html: "<b>Đây là email thử nghiệm từ SNMP_Printer</b>",
    });
    console.log("Mail sent:", info.messageId || info);
  } catch (err) {
    console.error("Error sending mail:", err);
  }
}

run();
```

Chạy:

```bash
node test-mail.js
```

## 7.2 Test public link — `test-public-link.js`

Tạo file `test-public-link.js`:

```js
require("dotenv").config();
const jwt = require("jsonwebtoken");

const SECRET = process.env.PUBLIC_LINK_SECRET;
const BASE = (process.env.PUBLIC_BASE_URL || "http://localhost:3000").replace(
  /\/$/,
  ""
);
const TTL = process.env.PUBLIC_LINK_TTL || "24h";

if (!SECRET) {
  console.error("PUBLIC_LINK_SECRET not set");
  process.exit(1);
}

const printerId = "000000000000000000000000"; // thay bằng id bất kỳ hoặc lấy từ db
const token = jwt.sign({ printerId: String(printerId) }, SECRET, {
  expiresIn: TTL,
});
const publicLink = `${BASE}/printer-detail/${printerId}?token=${encodeURIComponent(
  token
)}`;

console.log("Public link:", publicLink);

// verify
try {
  const payload = jwt.verify(token, SECRET);
  console.log("Token valid, payload:", payload);
} catch (e) {
  console.error("Token verify error:", e.message);
}
```

Chạy:

```bash
node test-public-link.js
```

Mở link in browser để kiểm tra route `/printer-detail/:id` xử lý token hay không.

---

# 8. Thay đổi & tùy chỉnh `mailer.js`

File gốc: `utils/mailer.js` — thực hiện gửi email và tạo public link.

## 8.1 Nếu bạn chỉ muốn thay đổi **nội dung email/HTML/logo**

- Mở `utils/mailer.js`, tìm biến `html = `...``
- Thay đổi văn bản, tiêu đề, hoặc đường dẫn logo (file `public/logo.png`).

Ví dụ thay `FROM_EMAIL` hiển thị tên công ty:

```js
const mailOptions = {
  from: '"Silk Sense Hoi An" <no-reply@silksenseresort.com>',
  to: toEmails.join(","),
  subject,
  html,
  attachments: [
    { filename: "logo.png", path: "public/logo.png", cid: "companyLogo" },
  ],
};
```

> Nếu muốn hiển thị tên kèm email, viết theo format `"Tên" <email@example.com>`.

## 8.2 Thêm CC / BCC hoặc người quản lý

Thêm trường `cc` hoặc `bcc` vào `mailOptions`:

```js
mailOptions.cc = "manager@company.com";
mailOptions.bcc = "audit@company.com";
```

## 8.3 Thay đổi logic tìm người nhận

Hiện tại code lấy email từ collection `User` theo `department`. Nếu bạn muốn gửi thêm đến 1 danh sách admin cố định, chỉnh như:

```js
const extra = ["it@company.com"];
const toEmails = [
  ...new Set([...users.map((u) => u.email).filter(Boolean), ...extra]),
];
```

## 8.4 Ghi log chi tiết hơn

Bạn có thể log chi tiết `info` trả về từ `transporter.sendMail` để kiểm tra `response` hay `messageId`.

---

# 9. Backup & Restore DB

## 9.1 Backup (mongodump)

```bash
mongodump --host=localhost --port=27017 --db=qlPrinter --out=C:\mongo_backup
```

Kết quả: `C:\mongo_backup\qlPrinter\` chứa file `.bson` và `.json` cho mỗi collection.

## 9.2 Restore (mongorestore)

```bash
mongorestore --host=localhost --port=27017 --db=qlPrinter C:\mongo_backup\qlPrinter
```

## 9.3 Export/Import bằng MongoDB Compass

- Export collection → chọn JSON (xuất từng collection).
- Import data → chọn file JSON tương ứng vào collection mới.

---

# 10. Troubleshooting (lỗi thường gặp & cách khắc phục)

- **"⚠ SMTP not configured"**: thiếu `SMTP_HOST` hoặc `SMTP_USER` hoặc `SMTP_PASS` trong `.env`.
- **Invalid login / 535**: kiểm tra email & app password; bật 2FA; kiểm tra xem nhà cung cấp email có chặn SMTP không.
- **ECONNECTION / timeout**: kiểm tra port, firewall hoặc blocking ISP.
- **Email gửi nhưng người nhận không nhận**: kiểm tra spam, SPF/DKIM cho domain, hoặc giới hạn gửi từ nhà cung cấp.
- **Token invalid / jwt expired**: kiểm tra `PUBLIC_LINK_SECRET` và `PUBLIC_LINK_TTL`. Nếu secret bị đổi, token cũ bị hủy.
- **Link không mở được từ ngoài mạng**: cần port-forward router hoặc deploy app ra server public + HTTPS.
- **Logo không hiện**: đảm bảo `public/logo.png` tồn tại và đường dẫn đúng.

---

# 11. Bảo mật & Best practices

- **KHÔNG commit** `.env` vào git. Thêm `.env` vào `.gitignore`.
- Dùng App Password thay vì mật khẩu chính. Nếu dùng domain riêng, cấu hình SPF/DKIM.
- Nếu public: bắt buộc HTTPS cho `PUBLIC_BASE_URL`.
- Lưu `PUBLIC_LINK_SECRET` an toàn, rotate định kỳ nếu cần.
- Thiết lập `ALERT_COOLDOWN_MINUTES` hợp lý để tránh spamming.

---

# 12. FAQ ngắn

**Q:** Muốn thay đổi người nhận cảnh báo?
**A:** Thay email users trong collection `users` (field `email`) hoặc chỉnh logic trong `utils/mailer.js`.

**Q:** Muốn tắt email cảnh báo tạm thời?
**A:** Xóa/đặt trống `SMTP_USER`/`SMTP_PASS` hoặc cấu hình `transporter` thành null — nhưng tốt hơn là tắt rule gửi trong code.

---

# 13. Liên hệ / Ghi chú

- Tác giả:
- Hotline IT :

---
