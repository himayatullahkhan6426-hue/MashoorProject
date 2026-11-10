require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const session = require("express-session");
const PgSession = require("connect-pg-simple")(session);

const pool = require("./config/database");

const authRoutes = require("./routes/authRoutes");
const areaRoutes = require("./routes/areaRoutes");
const shopRoutes = require("./routes/shopRoutes");
const productRoutes = require("./routes/productRoutes");
const deliveryRoutes = require("./routes/deliveryRoutes");

const app = express();

const PORT = process.env.PORT || process.env.APP_PORT || 5000;

if (!process.env.SESSION_SECRET ||
    process.env.SESSION_SECRET.length < 32) {
  throw new Error("A strong SESSION_SECRET is required.");
}

if (!process.env.FRONTEND_URL) {
  throw new Error("FRONTEND_URL is required.");
}

if (process.env.APP_ENV === "production") {
  app.set("trust proxy", 1);
}

app.use(helmet());

app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true,
}));

app.use(express.json());

app.use(session({
  name: "missnoori.sid",

  store: new PgSession({
    pool,
    tableName: "user_sessions",
    createTableIfMissing: true,
  }),

  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,

  cookie: {
    httpOnly: true,
    secure: process.env.APP_ENV === "production",
    sameSite: process.env.APP_ENV === "production" ? "none" : "lax",
    maxAge: 8 * 60 * 60 * 1000,
    path: "/",
  },
}));

// Health check
app.get("/api/health", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW() AS database_time");

    res.json({
      success: true,
      message: "Miss Noori backend is running.",
      database: "Connected",
      time: result.rows[0].database_time,
    });
  } catch (error) {
    console.error("Database health error:", error.message);

    res.status(500).json({
      success: false,
      message: "Database connection failed.",
    });
  }
});

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/areas", areaRoutes);
app.use("/api/shops", shopRoutes);
app.use("/api/products", productRoutes);
app.use("/api/deliveries", deliveryRoutes);

// Start server
app.listen(PORT, "0.0.0.0", () => {
  console.log(
    `${process.env.APP_NAME || "Miss Noori"} backend running on port ${PORT}`
  );
});