
import bcrypt from "bcryptjs";
import db from "../database/localDb";

const ITERATIONS = 310000;
const HASH_LENGTH = 256;
const DEVICE_PASSWORD_KEY = "device_password";

function normalizeUsername(username) {
  return String(username || "").trim().toLowerCase();
}

function bytesToBase64(bytes) {
  return btoa(String.fromCharCode(...bytes));
}

function base64ToBytes(value) {
  return Uint8Array.from(atob(value), (char) =>
    char.charCodeAt(0)
  );
}

async function hashPassword(password, salt) {
  const encoder = new TextEncoder();

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const hash = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: ITERATIONS,
      hash: "SHA-256",
    },
    key,
    HASH_LENGTH
  );

  return new Uint8Array(hash);
}

function safeUser(user) {
  if (!user) return null;

  const {
    password_hash,
    password_salt,
    password_algorithm,
    ...publicUser
  } = user;

  return publicUser;
}

function hashesMatch(first, second) {
  if (first.length !== second.length) return false;

  let difference = 0;

  for (let i = 0; i < first.length; i++) {
    difference |= first[i] ^ second[i];
  }

  return difference === 0;
}

// ==========================================
// DEVICE PASSWORD
// ==========================================

export async function hasDevicePassword() {
  const settings = await db.appSettings.get(
    DEVICE_PASSWORD_KEY
  );

  return Boolean(
    settings?.password_hash &&
    settings?.password_salt
  );
}

export async function setDevicePassword(password) {
  if (!password || password.length < 8) {
    throw new Error(
      "Password must contain at least 8 characters."
    );
  }

  const existing = await hasDevicePassword();

  if (existing) {
    throw new Error(
      "Device password is already set."
    );
  }

  const salt = crypto.getRandomValues(
    new Uint8Array(16)
  );

  const hash = await hashPassword(password, salt);

  await db.appSettings.put({
    key: DEVICE_PASSWORD_KEY,
    password_hash: bytesToBase64(hash),
    password_salt: bytesToBase64(salt),
    password_algorithm: "PBKDF2",
    iterations: ITERATIONS,
    updated_at: new Date().toISOString(),
  });

  return true;
}

export async function verifyDevicePassword(password) {
  if (!password) {
    throw new Error("Please enter your password.");
  }

  const settings = await db.appSettings.get(
    DEVICE_PASSWORD_KEY
  );

  if (!settings?.password_hash || !settings?.password_salt) {
    throw new Error(
      "Device password has not been set."
    );
  }

  if (settings.password_algorithm !== "PBKDF2") {
    throw new Error(
      "Device password configuration is invalid."
    );
  }

  const salt = base64ToBytes(settings.password_salt);
  const storedHash = base64ToBytes(settings.password_hash);

  const enteredHash = await hashPassword(password, salt);

  if (!hashesMatch(storedHash, enteredHash)) {
    throw new Error("Incorrect password.");
  }

  return true;
}

// ==========================================
// IMPORT LEGACY AIVEN OWNER
// ==========================================

export async function importLegacyOwner(owner) {
  if (!owner || owner.role !== "OWNER") {
    throw new Error("Invalid OWNER export file.");
  }

  if (
    !owner.username ||
    !owner.full_name ||
    !owner.password_hash
  ) {
    throw new Error("OWNER account data is incomplete.");
  }

  if (!String(owner.password_hash).startsWith("$2")) {
    throw new Error("Invalid bcrypt password hash.");
  }

  const username = normalizeUsername(owner.username);

  const existing = await db.users
    .where("username")
    .equals(username)
    .first();

  if (existing) {
    throw new Error("This username already exists locally.");
  }

  const existingUsers = await db.users.toArray();

  if (existingUsers.length > 0) {
    throw new Error(
      "Local users already exist. OWNER import is allowed only into an empty local user database."
    );
  }

  const localOwner = {
    id: String(owner.id || crypto.randomUUID()),
    fullName: String(owner.full_name).trim(),
    username,
    email: String(owner.email || "").trim().toLowerCase(),
    role: "OWNER",
    is_active: owner.is_active !== false,
    password_hash: owner.password_hash,
    password_salt: null,
    password_algorithm: "bcrypt",
    created_at: owner.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  await db.users.add(localOwner);

  return safeUser(localOwner);
}

// ==========================================
// CREATE LOCAL USER
// ==========================================

export async function createLocalUser({
  fullName,
  username,
  email = "",
  role,
  password,
  is_active = true,
}) {
  const cleanUsername = normalizeUsername(username);

  if (!fullName?.trim()) {
    throw new Error("Full name is required.");
  }

  if (!cleanUsername) {
    throw new Error("Username is required.");
  }

  if (!role?.trim()) {
    throw new Error("User role is required.");
  }

  if (!password || password.length < 8) {
    throw new Error("Password must contain at least 8 characters.");
  }

  const existing = await db.users
    .where("username")
    .equals(cleanUsername)
    .first();

  if (existing) {
    throw new Error("This username already exists.");
  }

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await hashPassword(password, salt);

  const user = {
    id: crypto.randomUUID(),
    fullName: fullName.trim(),
    username: cleanUsername,
    email: email.trim(),
    role: role.trim().toUpperCase(),
    is_active: Boolean(is_active),
    password_hash: bytesToBase64(hash),
    password_salt: bytesToBase64(salt),
    password_algorithm: "PBKDF2",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  await db.users.add(user);

  return safeUser(user);
}

// ==========================================
// LOCAL ACCOUNT LOGIN - LEGACY SUPPORT
// ==========================================

export async function loginLocalUser(username, password) {
  const cleanUsername = normalizeUsername(username);

  if (!cleanUsername || !password) {
    throw new Error("Username and password are required.");
  }

  const user = await db.users
    .where("username")
    .equals(cleanUsername)
    .first();

  if (!user || user.is_active === false) {
    throw new Error("Invalid username or password.");
  }

  if (
    user.password_algorithm === "bcrypt" ||
    String(user.password_hash || "").startsWith("$2")
  ) {
    const validPassword = await bcrypt.compare(
      password,
      user.password_hash
    );

    if (!validPassword) {
      throw new Error("Invalid username or password.");
    }

    const salt = crypto.getRandomValues(new Uint8Array(16));
    const hash = await hashPassword(password, salt);

    await db.users.update(user.id, {
      password_hash: bytesToBase64(hash),
      password_salt: bytesToBase64(salt),
      password_algorithm: "PBKDF2",
      updated_at: new Date().toISOString(),
    });

    const updatedUser = await db.users.get(user.id);

    return safeUser(updatedUser);
  }

  if (!user.password_salt) {
    throw new Error("Account password data is invalid.");
  }

  const salt = base64ToBytes(user.password_salt);
  const storedHash = base64ToBytes(user.password_hash);
  const enteredHash = await hashPassword(password, salt);

  if (!hashesMatch(storedHash, enteredHash)) {
    throw new Error("Invalid username or password.");
  }

  return safeUser(user);
}

// ==========================================
// GET ALL LOCAL USERS
// ==========================================

export async function getLocalUsers() {
  const users = await db.users.toArray();
  return users.map(safeUser);
}

// ==========================================
// GET ONE LOCAL USER
// ==========================================

export async function getLocalUser(userId) {
  const user = await db.users.get(userId);
  return safeUser(user);
}

// ==========================================
// UPDATE LOCAL USER
// ==========================================

export async function updateLocalUser(userId, updates) {
  const allowedFields = [
    "fullName",
    "email",
    "role",
    "is_active",
  ];

  const safeUpdates = {};

  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      safeUpdates[field] =
        field === "role"
          ? String(updates[field]).trim().toUpperCase()
          : field === "is_active"
            ? Boolean(updates[field])
            : String(updates[field]).trim();
    }
  }

  safeUpdates.updated_at = new Date().toISOString();

  await db.users.update(userId, safeUpdates);

  return getLocalUser(userId);
}

// ==========================================
// CHANGE LOCAL PASSWORD
// ==========================================

export async function changeLocalPassword(userId, newPassword) {
  if (!newPassword || newPassword.length < 8) {
    throw new Error("Password must contain at least 8 characters.");
  }

  const user = await db.users.get(userId);

  if (!user) {
    throw new Error("User not found.");
  }

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await hashPassword(newPassword, salt);

  await db.users.update(userId, {
    password_salt: bytesToBase64(salt),
    password_hash: bytesToBase64(hash),
    password_algorithm: "PBKDF2",
    updated_at: new Date().toISOString(),
  });

  return true;
}

// ==========================================
// DELETE LOCAL USER
// ==========================================

export async function deleteLocalUser(userId) {
  await db.users.delete(userId);
  return true;
}
