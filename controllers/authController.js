const User = require("../models/user");

exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });

    if (!user || !(await user.comparePassword(password))) {
      return res.render("login", { error: "Sai thông tin đăng nhập" });
    }

    // Kiểm tra trạng thái chặn
    if (user.isBlocked) {
      return res.render("login", { error: "Tài khoản của bạn đã bị chặn" });
    }

    // Lưu thông tin tối thiểu vào session
    req.session.user = {
      _id: user._id,
      username: user.username,
      role: user.role,
    };

    res.redirect("/dashboard");
  } catch (err) {
    console.error("Login error:", err);
    res.render("login", { error: "Có lỗi xảy ra, vui lòng thử lại" });
  }
};

exports.logout = (req, res) => {
  req.session.destroy(() => res.redirect("/login"));
};

exports.getChangePassword = (req, res) => {
  res.render("changePassword", {
    error: null,
    success: null,
    user: req.session.user,
  });
};

exports.changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword, confirmPassword } = req.body;
    const dbUser = await User.findById(req.session.user._id);
    if (!dbUser)
      return res.render("changePassword", {
        error: "Không tìm thấy tài khoản",
        success: null,
      });

    if (!(await dbUser.comparePassword(oldPassword))) {
      return res.render("changePassword", {
        error: "Mật khẩu cũ không đúng",
        success: null,
      });
    }
    if (!newPassword || newPassword.length < 6) {
      return res.render("changePassword", {
        error: "Mật khẩu mới tối thiểu 6 ký tự",
        success: null,
      });
    }
    if (newPassword !== confirmPassword) {
      return res.render("changePassword", {
        error: "Xác nhận mật khẩu không khớp",
        success: null,
      });
    }

    dbUser.password = newPassword; // sẽ được hash bởi pre('save')
    await dbUser.save();

    res.render("changePassword", {
      error: null,
      success: "Đổi mật khẩu thành công",
    });
  } catch (err) {
    console.error("Change password error:", err);
    res.render("changePassword", { error: "Có lỗi xảy ra", success: null });
  }
};
