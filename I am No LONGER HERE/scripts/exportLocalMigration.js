
const path = require("path");
const fs = require("fs");

// Load backend/.env explicitly
require("dotenv").config({
  path: path.resolve(__dirname, "../.env"),
});

// Load database only after environment variables
const pool = require("../config/database");

async function exportMigration() {
  const client = await pool.connect();
  let transactionStarted = false;

  try {
    console.log("Starting Aiven migration export...");

    await client.query("BEGIN TRANSACTION READ ONLY");
    transactionStarted = true;

    const [
      areasResult,
      shopsResult,
      adjustmentsResult,
      ownerResult,
    ] = await Promise.all([
      client.query("SELECT * FROM areas ORDER BY id"),
      client.query("SELECT * FROM shops ORDER BY id"),
      client.query(
        "SELECT * FROM balance_adjustments ORDER BY id"
      ),
      client.query(`
        SELECT id, full_name, username, email,
               password_hash, role, is_active,
               created_at, updated_at
        FROM users
        WHERE role = 'OWNER'
        ORDER BY id
      `),
    ]);

    const migrationData = {
      application: "Miss Noori Cosmetics Management Software",
      export_type: "LOCAL_ONLY_MIGRATION",
      version: 1,
      exported_at: new Date().toISOString(),
      source: "Aiven PostgreSQL",

      data: {
        areas: areasResult.rows,
        shops: shopsResult.rows,
        balance_adjustments: adjustmentsResult.rows,
        owners: ownerResult.rows,
      },

      counts: {
        areas: areasResult.rowCount,
        shops: shopsResult.rowCount,
        balance_adjustments: adjustmentsResult.rowCount,
        owners: ownerResult.rowCount,
      },
    };

    const exportPath = path.join(
      __dirname,
      "missnoori-migration-export.json"
    );

    fs.writeFileSync(
      exportPath,
      JSON.stringify(migrationData, null, 2),
      "utf8"
    );

    await client.query("COMMIT");
    transactionStarted = false;

    console.log("\nExport completed successfully!");
    console.log("Areas:", areasResult.rowCount);
    console.log("Shops:", shopsResult.rowCount);
    console.log(
      "Balance Adjustments:",
      adjustmentsResult.rowCount
    );
    console.log("Owners:", ownerResult.rowCount);
    console.log("\nFile:", exportPath);
  } catch (error) {
    if (transactionStarted) {
      await client.query("ROLLBACK");
    }

    console.error("Migration export failed:", error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

exportMigration();
