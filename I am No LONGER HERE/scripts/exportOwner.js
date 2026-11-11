
require("dotenv").config();

const fs = require("fs");
const path = require("path");
const pool = require("../config/database");

async function exportOwner() {
  try {
    const result = await pool.query(`
      SELECT
        id,
        full_name,
        username,
        email,
        password_hash,
        role,
        is_active,
        created_at
      FROM users
      WHERE role = 'OWNER'
      LIMIT 1
    `);

    if (result.rows.length === 0) {
      console.log("No OWNER account found in Aiven.");
      return;
    }

    const owner = result.rows[0];

    const exportPath = path.join(
      __dirname,
      "owner-export.json"
    );

    fs.writeFileSync(
      exportPath,
      JSON.stringify(owner, null, 2),
      "utf8"
    );

    console.log("OWNER account exported successfully.");
    console.log("File:", exportPath);
    console.log("Username:", owner.username);
    console.log("Role:", owner.role);
    console.log("Password hash exported: Yes");
  } catch (error) {
    console.error("Export failed:", error.message);
  } finally {
    await pool.end();
  }
}

exportOwner();
