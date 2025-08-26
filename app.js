require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const path = require("path");
const app = express();
require("./config/db");

app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
  })
);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use("/", require("./routes/authRoutes"));
app.use(
  "/printers",
  (req, res, next) => {
    if (!req.session.user) return res.redirect("/login");
    next();
  },
  require("./routes/printerRoutes")
);

app.get("/dashboard", (req, res) => res.redirect("/printers"));

app.listen(3000, () => console.log("Server: http://localhost:3000"));
