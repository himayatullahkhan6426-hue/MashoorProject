const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is missing from environment variables.");
}

let caCertificate;

// Production: read certificate from Render environment variable.
if (process.env.DATABASE_SSL_CA_BASE64) {
  caCertificate = Buffer.from(
    process.env.DATABASE_SSL_CA_BASE64,
    "base64"
  ).toString("utf8");
} else {
  // Local development: read certificate from local file.
  const caPath = path.resolve(__dirname, "../certs/ca.pem");

  if (!fs.existsSync(caPath)) {
    throw new Error("Aiven CA certificate not found!");
  }

  caCertificate = fs.readFileSync(caPath, "utf8");
}

if (!caCertificate.includes("-----BEGIN CERTIFICATE-----")) {
  throw new Error("Invalid Aiven CA certificate.");
}

// Configure SSL explicitly.
const databaseUrl = process.env.DATABASE_URL.split("?")[0];

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: {
    ca: caCertificate,
    rejectUnauthorized: true,
  },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on("error", (error) => {
  console.error("PostgreSQL error:", error.message);
});

module.exports = pool;