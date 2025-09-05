const User = require("../models/user");
const bcrypt = require("bcryptjs");

exports.listUsers = async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.render("users", {
      users,
      user: req.session.user,
      error: req.query.error || null,
      success: req.query.success || null,
    });
  } catch (err) {
    console.error("List users error:", err);
    res.status(500).send("Lỗi tải danh sách người dùng");
  }
};

exports.addUser = async (req, res) => {
  try {
    const { username, password, role } = req.body;
    if (!username || !password) {
      return res.redirect("/users?error=Thiếu username hoặc password");
    }
    const exists = await User.findOne({ username });
    if (exists) return res.redirect("/users?error=Tài khoản đã tồn tại");

    const user = new User({ username, password, role: role || "user" }); // password sẽ được hash
    await user.save();
    return res.redirect("/users?success=Thêm người dùng thành công");
  } catch (err) {
    console.error("Add user error:", err);
    res.redirect("/users?error=Thêm người dùng thất bại");
  }
};

exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { username, role, password } = req.body;

    const u = await User.findById(id);
    if (!u) return res.redirect("/users?error=Không tìm thấy người dùng");

    // Không cho tự hạ quyền chính mình về user (tuỳ chọn)
    if (String(u._id) === String(req.session.user._id) && role === "user") {
      return res.redirect("/users?error=Không thể tự hạ quyền của chính bạn");
    }

    if (username) u.username = username;
    if (role) u.role = role;
    if (password && password.trim() !== "") u.password = password; // sẽ hash ở pre('save')
    await u.save();

    // Nếu sửa chính mình, cập nhật lại session
    if (String(u._id) === String(req.session.user._id)) {
      req.session.user.username = u.username;
      req.session.user.role = u.role;
    }

    res.redirect("/users?success=Cập nhật thành công");
  } catch (err) {
    console.error("Update user error:", err);
    res.redirect("/users?error=Cập nhật thất bại");
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    if (String(id) === String(req.session.user._id)) {
      return res.redirect("/users?error=Không thể xóa chính mình");
    }
    await User.findByIdAndDelete(id);
    res.redirect("/users?success=Đã xóa người dùng");
  } catch (err) {
    console.error("Delete user error:", err);
    res.redirect("/users?error=Xóa người dùng thất bại");
  }
};
