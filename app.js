require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const path = require("path");

const printerController = require("./controllers/printerController");
const { isAuthenticated, isAdmin, exposeUser } = require("./middlewares/auth");
const User = require("./models/user");
const app = express();

// Kết nối DB
require("./config/db");

// Middleware
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET || "secret-key",
    resave: false,
    saveUninitialized: false,
  })
);
app.use(exposeUser); // để EJS biết currentUser

// View engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Routes
app.use("/", require("./routes/authRoutes"));
app.use("/printer-detail", require("./routes/printerDetailRoutes"));
app.use("/printers", isAuthenticated, require("./routes/printerRoutes"));
app.use("/users", isAuthenticated, isAdmin, require("./routes/userRoutes"));
app.use(
  "/departments",
  isAuthenticated,
  isAdmin,
  require("./routes/departmentRoutes")
);

// Redirect dashboard
app.get("/dashboard", (req, res) => res.redirect("/printers"));

// Seed admin nếu chưa có
mongoose.connection.once("open", async () => {
  try {
    const count = await User.countDocuments({ role: "admin" });
    if (count === 0) {
      const admin = new User({
        username: "admin",
        password: "admin123", // sẽ được hash trong model
        role: "admin",
      });
      await admin.save();
      console.log(
        "✅ Seeded admin: username=admin, password=admin123 (hãy đổi ngay!)"
      );
    }
  } catch (e) {
    console.error("Seed admin error:", e);
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`Server running at http://localhost:${PORT}`)
);
