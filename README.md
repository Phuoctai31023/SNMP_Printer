HƯỚNG DẪN CÀI ĐẶT VÀ CHẠY CHƯƠNG TRÌNH SNMP_Printer

1. Yêu cầu trước khi tải

- Máy tính cần cài Node.js (phiên bản LTS, ví dụ 18.x hoặc 20.x).
  Tải tại: https://nodejs.org/
- Máy tính cần cài Git để tải code từ GitHub.
  Tải tại: https://git-scm.com/downloads
- Kết nối mạng LAN/WiFi (nếu bạn muốn theo dõi máy in qua SNMP).

2. Tải code về máy

- Mở Command Prompt (CMD) hoặc PowerShell.
- Chạy lệnh sau để tải code:
  git clone https://github.com/Phuoctai31023/SNMP_Printer.git
- Sau khi tải xong, di chuyển vào thư mục code:
  cd SNMP_Printer

3. Cài đặt thư viện

- Trong thư mục SNMP_Printer, chạy lệnh:
  npm install
  (Lệnh này sẽ cài đặt toàn bộ thư viện cần thiết trong file package.json)

4. Cấu hình chương trình

- Kiểm tra & thay đổi file cấu hình (.env)

* Cấu hình MongoDB (database để lưu dữ liệu máy in) :
  MONGO_URI=mongodb://localhost:27017/qlPrinter
* Email (gửi cảnh báo qua mail) :
  SMTP_USER=phuoctaiworkit@gmail.com
  SMTP_PASS=ewfqffbfugvyqhbc  
  FROM_EMAIL=phuoctaiworkit@gmail.com
* JWT (JsonWebToken)
  PUBLIC_LINK_SECRET=478a94cae6d805fcb1aaa4338be14fd42ae3dae23028f2e9c29fa7c18877076f16e441cad7e01ea395c4e9a290fe9e46
  PUBLIC_BASE_URL=http://localhost:3000
  PUBLIC_LINK_TTL=24h

5. Chạy chương trình

- Chạy server:
  npm start hoặc node app.js
- Nếu thành công, bạn sẽ thấy thông báo server chạy (ví dụ: "Server running at http://localhost:3000")

6. Truy cập ứng dụng

- Mở trình duyệt web (Chrome, Edge, Firefox...).
- Gõ địa chỉ: http://localhost:3000/printers
- Bạn sẽ thấy giao diện web của ứng dụng.

CHI TIẾT CẤU HÌNH CHƯƠNG TRÌNH
.env

# MongoDB

MONGO_URI=mongodb://localhost:27017/qlPrinter
SESSION_SECRET=mysecret

# Gmail SMTP (dùng để gửi email cảnh báo)

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=tenemailcuaban@gmail.com
SMTP_PASS=matkhaungungdungcuaban
FROM_EMAIL=tenemailcuaban@gmail.com

# Public link (tạo link bảo mật khi gửi qua email)

PUBLIC_LINK_SECRET=478a94cae6d805fcb1aaa4338be14fd42ae3dae23028f2e9c29fa7c18877076f16e441cad7e01ea395c4e9a290fe9e46
PUBLIC_BASE_URL=http://localhost:3000
PUBLIC_LINK_TTL=24h

# Thời gian giữa 2 lần gửi mail cảnh báo (phút)

ALERT_COOLDOWN_MINUTES=60



1. Cấu hình Gmail SMTP (SMTP_USER / SMTP_PASS / FROM_EMAIL)
   Tóm tắt: Google không cho phép dùng mật khẩu tài khoản chính cho SMTP nếu chưa bật 2-step; bạn cần bật 2-Step Verification rồi tạo App password. App password (16 ký tự) dùng làm SMTP_PASS.
   Bước 1 — Bật 2-Step Verification & tạo App Password
   • Vào trang Google Account của email bạn muốn dùng (ví dụ you@example.com).
    Security → 2-Step Verification → bật.
   • Sau khi bật 2-Step Verification, vào: Security → App passwords.
   • Tạo App password:
   • Select app: Mail
   • Select device: Other (Custom name) → đặt tên ví dụ SNMP_Printer → Generate.
   • Google sẽ xuất ra 16 ký tự (không có dấu cách) — copy giá trị này, đó là SMTP_PASS.
   Bước 2 — Sửa .env
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_SECURE=false # false với 587 (STARTTLS); true với 465
   SMTP_USER=you@example.com
   SMTP_PASS=the-16-char-app-password-here
   FROM_EMAIL=you@example.com
   • SMTP_USER và FROM_EMAIL thường để cùng giá trị (you@example.com).
   • Nếu dùng port 465 thì SMTP_SECURE=true và SMTP_PORT=465. Với 587 dùng secure=false.

2. Cấu hình Public Link (PUBLIC_LINK_SECRET / PUBLIC_BASE_URL / PUBLIC_LINK_TTL)
   Bước 1 — Tạo PUBLIC_LINK_SECRET mạnh
   Bạn cần 1 chuỗi ngẫu nhiên dài — dùng 64 byte hex hoặc 48-64 ký tự.
   Tạo nhanh bằng Node:
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   Copy chuỗi kết quả — đặt vào .env:
   PUBLIC_LINK_SECRET=put_the_generated_hex_string_here
   Bước 2 — PUBLIC_BASE_URL
   Đặt URL nơi app chạy (dùng để tạo link trong email):
   • Local dev: http://localhost:3000
   • LAN (chạy trên máy trong mạng): http://192.168.1.100:3000 (thay IP bằng IP máy chủ)
   • Public (trên internet): https://your-domain.com — nên ưu tiên HTTPS.
   Bước 3 — PUBLIC_LINK_TTL (thời hạn token)
   PUBLIC_LINK_TTL truyền thẳng vào jwt.sign(..., { expiresIn: PUBLIC_TTL }). jsonwebtoken chấp nhận:
   • chuỗi như 24h, 7d, 15m
   • hoặc số giây (ví dụ 3600)

3. BẢN TÓM TẮT

1) Clone repo.
2) Tạo file .env (không commit).
3) Điền:
   • MONGO_URI tới MongoDB của chính mình.
   • SMTP_USER = email, bật 2FA → tạo app password → gán SMTP_PASS.
   • FROM_EMAIL = email gửi (thường trùng SMTP_USER).
   • Tạo PUBLIC_LINK_SECRET mạnh bằng lệnh Node/OpenSSL.
   • PUBLIC_BASE_URL = IP hoặc domain nơi app chạy.
   • PUBLIC_LINK_TTL = 24h hoặc mong muốn.
   • npm install → npm start (hoặc dùng process manager như PM2).
