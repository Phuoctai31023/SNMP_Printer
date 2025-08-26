const User = require("../models/user");
exports.login = async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username, password });
  if (!user) return res.render("login", { error: "Sai thông tin đăng nhập" });
  req.session.user = user;
  res.redirect("/dashboard");
};
exports.logout = (req, res) => {
  req.session.destroy(() => res.redirect("/login"));
};
