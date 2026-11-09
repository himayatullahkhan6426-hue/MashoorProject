require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const session = require("express-session");
const PgSession = require("connect-pg-simple")(session);

const pool = require("./config/database");
const authRoutes = require("./routes/authRoutes");

const app = express();

const PORT = process.env.APP_PORT || 5000;

if (!process.env.SESSION_SECRET ||
    process.env.SESSION_SECRET.length < 32) {
  throw new Error("A strong SESSION_SECRET is required.");
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
    sameSite:
      process.env.APP_ENV === "production" ? "none" : "lax",
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
    console.error("Database health error:", error);

    res.status(500).json({
      success: false,
      message: "Database connection failed.",
      error: error.message,
      code: error.code,
    });
  }
});

// Authentication APIs
app.use("/api/auth", authRoutes);

app.listen(PORT, () => {
  console.log(`Miss Noori backend running on port ${PORT}`);
});