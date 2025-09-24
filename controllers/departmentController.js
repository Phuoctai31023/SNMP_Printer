const Department = require("../models/department");
const Printer = require("../models/printer");
const User = require("../models/user");
const formatDateTime = require("../utils/formatDateTime");

function escapeForRegex(str = "") {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

exports.listDepartments = async (req, res) => {
  try {
    const { error, success } = req.query;
    let departments = await Department.find().sort({ createdAt: -1 });

    departments = departments.map((d) => ({
      ...d.toObject(),
      createdAtFormatted: formatDateTime(d.createdAt),
      updatedAtFormatted: formatDateTime(d.updatedAt),
    }));

    res.render("departments", {
      departments,
      user: req.session.user,
      error: error || null,
      success: success || null,
    });
  } catch (err) {
    console.error("Error loading departments:", err);
    res.status(500).send("Lỗi load danh sách bộ phận");
  }
};

exports.addDepartment = async (req, res) => {
  try {
    console.log("=== addDepartment called ===");
    console.log(
      "Session user:",
      req.session && req.session.user ? req.session.user.username : null
    );
    console.log("Headers:", req.headers && req.headers["content-type"]);
    console.log("Body raw:", req.body);

    if (!req.body) {
      console.error(
        "POST body is undefined - missing express.urlencoded middleware?"
      );
      return res.redirect(
        "/departments?error=" +
          encodeURIComponent("Dữ liệu gửi lên trống (kiểm tra body-parser).")
      );
    }

    const nameRaw = req.body.name;
    const name = typeof nameRaw === "string" ? nameRaw.trim() : "";
    const description = req.body.description
      ? String(req.body.description).trim()
      : "";

    if (!name) {
      return res.redirect(
        "/departments?error=" +
          encodeURIComponent("Tên bộ phận không được để trống")
      );
    }

    // Kiểm tra trùng
    const existing = await Department.findOne({ name: name }).collation({
      locale: "en",
      strength: 2,
    });
    if (existing) {
      console.log("Existing department found:", existing.name);
      return res.redirect(
        "/departments?error=" +
          encodeURIComponent(`Bộ phận "${name}" đã tồn tại`)
      );
    }

    const dpm = new Department({ name, description });
    await dpm.save();

    console.log("Department saved:", dpm._id);
    return res.redirect(
      "/departments?success=" + encodeURIComponent("Thêm bộ phận thành công")
    );
  } catch (err) {
    console.error("Error adding department:", err);

    if (err && err.code === 11000) {
      // duplicate
      return res.redirect(
        "/departments?error=" +
          encodeURIComponent("Bộ phận trùng tên (duplicate).")
      );
    }

    if (err && err.name === "ValidationError") {
      const msgs = Object.values(err.errors)
        .map((e) => e.message)
        .join(", ");
      return res.redirect(
        "/departments?error=" + encodeURIComponent(msgs || "Validation error")
      );
    }

    // Log stack server-side
    console.error(err && err.stack ? err.stack : err);
    const clientMsg =
      err && err.message ? err.message : "Thêm bộ phận thất bại";
    return res.redirect("/departments?error=" + encodeURIComponent(clientMsg));
  }
};

exports.updateDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const nameRaw = req.body.name;
    const name = typeof nameRaw === "string" ? nameRaw.trim() : "";
    const description = req.body.description
      ? String(req.body.description).trim()
      : "";

    if (!name) {
      return res.redirect(
        "/departments?error=" +
          encodeURIComponent("Tên bộ phận không được để trống")
      );
    }

    const existing = await Department.findOne({
      name: name,
      _id: { $ne: id },
    }).collation({ locale: "en", strength: 2 });
    if (existing) {
      return res.redirect(
        "/departments?error=" +
          encodeURIComponent(`Tên bộ phận "${name}" đã tồn tại`)
      );
    }

    await Department.findByIdAndUpdate(id, { name, description });
    return res.redirect(
      "/departments?success=" +
        encodeURIComponent("Cập nhật bộ phận thành công")
    );
  } catch (err) {
    console.error("Error updating department:", err);
    if (err && err.code === 11000) {
      return res.redirect(
        "/departments?error=" + encodeURIComponent("Trùng tên (duplicate key).")
      );
    }
    return res.redirect(
      "/departments?error=" +
        encodeURIComponent(err.message || "Cập nhật thất bại")
    );
  }
};

exports.deleteDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    await Department.findByIdAndDelete(id);
    return res.redirect(
      "/departments?success=" + encodeURIComponent("Đã xóa bộ phận thành công")
    );
  } catch (err) {
    console.error("Error deleting department:", err);
    return res.redirect(
      "/departments?error=" +
        encodeURIComponent(err.message || "Xóa bộ phận thất bại")
    );
  }
};

exports.getDepartmentDetail = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.redirect(
        "/departments?error=" + encodeURIComponent("ID bộ phận không hợp lệ")
      );
    }

    // Lấy thông tin bộ phận hiện tại
    const department = await Department.findById(id).lean();
    if (!department) {
      return res.redirect(
        "/departments?error=" + encodeURIComponent("Không tìm thấy bộ phận")
      );
    }

    // Lấy toàn bộ departments để hiển thị sidebar
    const departments = await Department.find()
      .select("name description") // chỉ lấy field cần thiết
      .sort({ name: 1 })
      .lean();

    // Lấy users thuộc phòng ban
    const users = await User.find({ department: id })
      .select("username email role isBlocked createdAt updatedAt")
      .sort({ username: 1 })
      .lean();

    // Lấy printers thuộc phòng ban
    const printers = await Printer.find({ dpm_ID: id })
      .select(
        "ip_address serial_number printer_type model type vendor toner_level online condition lastSnmpUpdate"
      )
      .lean();

    res.render("department_detail", {
      department,
      departments, // thêm vào để sidebar không lỗi
      users,
      printers,
      user: req.session.user,
      error: req.query.error || null,
      success: req.query.success || null,
    });
  } catch (err) {
    console.error("Error loading department detail:", err);
    res.status(500).send("Lỗi server khi tải chi tiết bộ phận");
  }
};
