
const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");

require("dotenv").config();

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is missing from environment variables."
  );
}

let caCertificate;

if (process.env.DATABASE_SSL_CA_BASE64) {
  caCertificate = Buffer.from(
    process.env.DATABASE_SSL_CA_BASE64,
    "base64"
  ).toString("utf8");
} else {
  const caPath = path.resolve(__dirname, "../certs/ca.pem");

  if (!fs.existsSync(caPath)) {
    throw new Error("Aiven CA certificate not found!");
  }

  caCertificate = fs.readFileSync(caPath, "utf8");
}

if (!caCertificate.includes("-----BEGIN CERTIFICATE-----")) {
  throw new Error("Invalid Aiven CA certificate.");
}

const databaseUrl = process.env.DATABASE_URL.split("?")[0];

const pool = new Pool({
  connectionString: databaseUrl,

  ssl: {
    ca: caCertificate,
    rejectUnauthorized: true,
  },

  // Connection pool
  max: 10,
  min: 1,

  // Connection management
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,

  // Keep connections alive
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,

  // Query timeout protection
  query_timeout: 15000,
  statement_timeout: 15000,
});

pool.on("connect", () => {
  console.log("[DATABASE] New PostgreSQL connection established.");
});

pool.on("error", (error) => {
  console.error("[DATABASE] Unexpected error:", error.message);
});

module.exports = pool;
