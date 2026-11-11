require("dotenv").config();

const readline = require("readline");
const bcrypt = require("bcrypt");
const pool = require("../config/database");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

async function createOwner() {
  const client = await pool.connect();

  try {
    // Check whether an Owner already exists
    const existingOwner = await client.query(
      "SELECT id FROM users WHERE role = 'OWNER' LIMIT 1"
    );

    if (existingOwner.rows.length > 0) {
      console.log("An Owner account already exists.");
      return;
    }

    const fullName = (await ask("Full name: ")).trim();
    const username = (await ask("Username: ")).trim();
    const email = (await ask("Email: ")).trim().toLowerCase();
    const password = await ask("Password: ");

    if (!fullName || !username || !email || !password) {
      console.log("All fields are required.");
      return;
    }

    if (password.length < 12) {
      console.log("Password must contain at least 12 characters.");
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await client.query(
      `INSERT INTO users
       (full_name, username, email, password_hash, role)
       VALUES ($1, $2, $3, $4, 'OWNER')`,
      [fullName, username, email, passwordHash]
    );

    console.log("Miss Noori Owner account created successfully!");
  } catch (error) {
    if (error.code === "23505") {
      console.log("Username or email already exists.");
    } else {
      console.error("Error:", error.message);
    }
  } finally {
    client.release();
    rl.close();
    await pool.end();
  }
}

createOwner();