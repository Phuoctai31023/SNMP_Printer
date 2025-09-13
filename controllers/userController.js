const User = require("../models/user");
const formatDateTime = require("../utils/formatDateTime");
const bannedWord = require("../utils/bannedWord");

const allowedUsernameRegex = /^[a-z][a-z0-9._@]*$/;

function validateUsernameFormat(username) {
  if (!username || typeof username !== "string")
    return { ok: false, msg: "Tên đăng nhập không hợp lệ" };

  if (/[A-Z]/.test(username))
    return { ok: false, msg: "Tên đăng nhập không được chứa chữ in hoa" };

  if (/\s/.test(username))
    return { ok: false, msg: "Tên đăng nhập không được chứa khoảng trắng" };

  if (
    /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(
      username
    )
  ) {
    return { ok: false, msg: "Tên đăng nhập không được chứa dấu" };
  }

  if (bannedWord.hasBadWord(username)) {
    return { ok: false, msg: "Tên đăng nhập chứa từ ngữ không phù hợp" };
  }

  if (!allowedUsernameRegex.test(username))
    return {
      ok: false,
      msg: "Tên đăng nhập chỉ gồm chữ thường, số, ký tự . _ @ và bắt đầu bằng chữ cái",
    };

  const specials = [".", "_", "@"];
  const duplicates = [];

  for (const s of specials) {
    const re = new RegExp("\\" + s, "g");
    const matches = username.match(re);
    const count = matches ? matches.length : 0;
    if (count > 1) {
      duplicates.push({ char: s, count });
    }
  }

  if (duplicates.length > 0) {
    if (duplicates.length === 1) {
      const d = duplicates[0];
      return {
        ok: false,
        msg: `Ký tự '${d.char}' chỉ được phép dùng 1 lần (đã dùng ${d.count} lần)`,
      };
    } else {
      const parts = duplicates.map((d) => `'${d.char}' (${d.count} lần)`);
      return {
        ok: false,
        msg: `Các ký tự ${parts.join(", ")} chỉ được phép dùng 1 lần`,
      };
    }
  }
  return { ok: true };
}

/**
 * Danh sách user
 */
exports.listUsers = async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 }).lean();
    const usersWithFormat = (users || []).map((u) => ({
      ...u,
      createdAtFormatted: formatDateTime(u.createdAt),
      updatedAtFormatted: formatDateTime(u.updatedAt),
    }));
    res.render("users", {
      users: usersWithFormat,
      user: req.session && req.session.user ? req.session.user : null,
      error: req.query.error || null,
      success: req.query.success || null,
    });
  } catch (err) {
    console.error("List users error:", err);
    res.status(500).send("Lỗi tải danh sách người dùng");
  }
};

/**
 * Thêm user mới
 */
exports.addUser = async (req, res) => {
  try {
    let { username, password, role } = req.body;
    if (!username || !password) {
      return res.redirect("/users?error=Thiếu username hoặc password");
    }
    username = username.trim();

    const v = validateUsernameFormat(username);
    if (!v.ok) return res.redirect(`/users?error=${encodeURIComponent(v.msg)}`);

    const exists = await User.findOne({ username });
    if (exists) return res.redirect("/users?error=Tài khoản đã tồn tại");

    const user = new User({ username, password, role: role || "user" });
    await user.save();
    return res.redirect("/users?success=Thêm người dùng thành công");
  } catch (err) {
    console.error("Add user error:", err);
    res.redirect("/users?error=Thêm người dùng thất bại");
  }
};

/**
 * Cập nhật user
 */
exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    let { username, role, password } = req.body;
    const u = await User.findById(id);
    if (!u) return res.redirect("/users?error=Không tìm thấy người dùng");

    // không cho tự hạ quyền chính mình
    if (
      req.session &&
      req.session.user &&
      String(u._id) === String(req.session.user._id) &&
      role === "user"
    ) {
      return res.redirect("/users?error=Không thể tự hạ quyền của chính bạn");
    }

    // chỉ check username nếu có thay đổi thực sự
    if (username && username.trim() !== u.username) {
      username = username.trim();

      const v = validateUsernameFormat(username);
      if (!v.ok)
        return res.redirect(`/users?error=${encodeURIComponent(v.msg)}`);

      const exists = await User.findOne({ username });
      if (exists && String(exists._id) !== String(u._id)) {
        return res.redirect("/users?error=Tên đăng nhập đã có người sử dụng");
      }

      u.username = username;
    }

    if (role) u.role = role;
    if (password && password.trim() !== "") u.password = password;
    await u.save();

    // sync lại session nếu user tự sửa mình
    if (
      req.session &&
      req.session.user &&
      String(u._id) === String(req.session.user._id)
    ) {
      req.session.user.username = u.username;
      req.session.user.role = u.role;
    }

    res.redirect("/users?success=Cập nhật thành công");
  } catch (err) {
    console.error("Update user error:", err);
    res.redirect("/users?error=Cập nhật thất bại");
  }
};

/**
 * Xóa user
 */
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    if (
      req.session &&
      String(id) === String(req.session.user && req.session.user._id)
    ) {
      return res.redirect("/users?error=Không thể xóa chính mình");
    }
    await User.findByIdAndDelete(id);
    res.redirect("/users?success=Đã xóa người dùng");
  } catch (err) {
    console.error("Delete user error:", err);
    res.redirect("/users?error=Xóa người dùng thất bại");
  }
};

/**
 * Chặn / bỏ chặn user
 */
exports.toggleBlockUser = async (req, res) => {
  try {
    const { id } = req.params;
    if (
      req.session &&
      String(id) === String(req.session.user && req.session.user._id)
    ) {
      return res.redirect("/users?error=Không thể tự chặn chính mình");
    }
    const u = await User.findById(id);
    if (!u) return res.redirect("/users?error=Không tìm thấy người dùng");

    u.isBlocked = !u.isBlocked;
    await u.save();

    res.redirect(
      `/users?success=${u.isBlocked ? "Đã chặn" : "Đã mở chặn"} người dùng`
    );
  } catch (err) {
    console.error("Toggle block user error:", err);
    res.redirect("/users?error=Thao tác thất bại");
  }
};
