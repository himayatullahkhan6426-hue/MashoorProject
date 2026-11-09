const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const caPath = path.resolve(__dirname, "../certs/ca.pem");

if (!fs.existsSync(caPath)) {
  throw new Error("Aiven CA certificate not found!");
}

const caCertificate = fs.readFileSync(caPath, "utf8");

if (!caCertificate.includes("-----BEGIN CERTIFICATE-----")) {
  throw new Error("Invalid CA certificate file.");
}

// Remove SSL query parameters from the URL.
// SSL will be configured explicitly below.
const databaseUrl = process.env.DATABASE_URL.split("?")[0];

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: {
    ca: caCertificate,
    rejectUnauthorized: true,
  },
});

pool.on("error", (error) => {
  console.error("PostgreSQL error:", error.message);
});

module.exports = pool;