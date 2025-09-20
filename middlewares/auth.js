const User = require("../models/user");

exports.isAuthenticated = async (req, res, next) => {
  if (!req.session.user) return res.redirect("/login");

  try {
    const dbUser = await User.findById(req.session.user._id);

    if (!dbUser || dbUser.isBlocked) {
      req.session.destroy(() => res.redirect("/login"));
      return;
    }
  } catch (err) {
    console.error("Auth check error:", err);
    return res.redirect("/login");
  }

  next();
};

exports.isAdmin = (req, res, next) => {
  if (!req.session.user || req.session.user.role !== "admin") {
    return res.status(403).send("Bạn không có quyền truy cập");
  }
  next();
};

// Đưa user vào res.locals để EJS dùng ẩn/hiện UI theo quyền
exports.exposeUser = (req, res, next) => {
  res.locals.currentUser = req.session.user || null;
  next();
};
