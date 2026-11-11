
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
const paymentRoutes = require("./routes/paymentRoutes");
const deliveryRoutes = require("./routes/deliveryRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const searchRoutes = require("./routes/searchRoutes");
const dailyReportRoutes = require("./routes/dailyReportRoutes");

const app = express();

const PORT = process.env.PORT || process.env.APP_PORT || 5000;
const isProduction = process.env.APP_ENV === "production";

if (
  !process.env.SESSION_SECRET ||
  process.env.SESSION_SECRET.length < 32
) {
  throw new Error("A strong SESSION_SECRET is required.");
}

if (!process.env.FRONTEND_URL) {
  throw new Error("FRONTEND_URL is required.");
}

if (isProduction) {
  app.set("trust proxy", 1);
}

app.use(helmet());

const allowedOrigins = [
  process.env.FRONTEND_URL,
  "http://localhost:5173",
  "http://127.0.0.1:5173",
].filter(Boolean);

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "1mb" }));

app.use((req, res, next) => {
  const start = process.hrtime.bigint();

  res.on("finish", () => {
    const duration =
      Number(process.hrtime.bigint() - start) / 1e6;

    console.log(
      `[API] ${req.method} ${req.originalUrl} | ${res.statusCode} | ${duration.toFixed(2)} ms`
    );

    if (duration > 1000) {
      console.warn(
        `[SLOW API] ${req.method} ${req.originalUrl} took ${duration.toFixed(2)} ms`
      );
    }
  });

  next();
});

app.use(
  session({
    name: "missnoori.sid",

    store: new PgSession({
      pool,
      tableName: "user_sessions",
      createTableIfMissing: true,
      pruneSessionInterval: 60,
    }),

    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    rolling: false,

    cookie: {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      maxAge: 8 * 60 * 60 * 1000,
      path: "/",
    },
  })
);

// Health checks
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Miss Noori backend is running.",
    server: "Healthy",
  });
});

app.get("/api/health/database", async (req, res) => {
  try {
    const start = process.hrtime.bigint();

    await pool.query("SELECT 1");

    const duration =
      Number(process.hrtime.bigint() - start) / 1e6;

    res.json({
      success: true,
      database: "Connected",
      responseTime: `${duration.toFixed(2)} ms`,
    });
  } catch (error) {
    console.error("Database health error:", error.message);

    res.status(503).json({
      success: false,
      database: "Unavailable",
      message: "Database connection failed.",
    });
  }
});

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/areas", areaRoutes);
app.use("/api/shops", shopRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/deliveries", deliveryRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/reports/daily", dailyReportRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "API endpoint not found.",
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error("Server error:", error.message);

  if (res.headersSent) {
    return next(error);
  }

  res.status(error.status || 500).json({
    success: false,
    message:
      error.status === 500
        ? "Internal server error."
        : error.message,
  });
});

// Start server
const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(
    `${process.env.APP_NAME || "Miss Noori"} backend running on port ${PORT}`
  );
});

// Graceful shutdown
async function shutdown() {
  console.log("Shutting down server...");

  server.close(async () => {
    try {
      await pool.end();
      console.log("Database pool closed.");
      process.exit(0);
    } catch (error) {
      console.error("Shutdown error:", error.message);
      process.exit(1);
    }
  });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
