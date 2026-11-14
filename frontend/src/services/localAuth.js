
import db from "../database/localDb";

const ITERATIONS = 310000;
const HASH_LENGTH = 256;
const DEVICE_PASSWORD_KEY = "device_password";

function ensureCrypto() {
  if (
    !globalThis.crypto?.subtle ||
    !globalThis.crypto?.getRandomValues
  ) {
    throw new Error(
      "Secure password storage is not available. Open the app using localhost or HTTPS."
    );
  }
}

function bytesToBase64(bytes) {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

function base64ToBytes(value) {
  return Uint8Array.from(atob(value), (char) =>
    char.charCodeAt(0)
  );
}

async function hashPassword(password, salt) {
  ensureCrypto();

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

function hashesMatch(first, second) {
  if (first.length !== second.length) return false;

  let difference = 0;

  for (let i = 0; i < first.length; i++) {
    difference |= first[i] ^ second[i];
  }

  return difference === 0;
}

// Check whether device password exists
export async function hasDevicePassword() {
  const settings = await db.appSettings.get(
    DEVICE_PASSWORD_KEY
  );

  return Boolean(
    settings?.password_hash &&
    settings?.password_salt
  );
}

// Set a new password OR replace the existing password
export async function setDevicePassword(password) {
  if (typeof password !== "string" || password.length < 8) {
    throw new Error(
      "Password must contain at least 8 characters."
    );
  }

  ensureCrypto();

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

// Verify device password
export async function verifyDevicePassword(password) {
  if (!password) {
    throw new Error("Please enter your password.");
  }

  const settings = await db.appSettings.get(
    DEVICE_PASSWORD_KEY
  );

  if (
    !settings?.password_hash ||
    !settings?.password_salt
  ) {
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
