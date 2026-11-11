
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LockKeyhole,
  Eye,
  EyeOff,
  Store,
  Upload,
  Database,
} from "lucide-react";

import db from "../database/localDb";
import {
  loginLocalUser,
  importLegacyOwner,
} from "../services/localAuth";
import { importLocalMigration } from "../services/localMigration";
import { useAuth } from "../context/AuthContext";
import "./Login.css";

function Login() {
  const navigate = useNavigate();
  const { setUser } = useAuth();

  const fileInputRef = useRef(null);
  const migrationInputRef = useRef(null);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("error");

  // ========================================
  // LOGIN
  // ========================================

  const handleLogin = async (e) => {
    e.preventDefault();

    setMessage("");
    setLoading(true);

    try {
      const enteredUsername = username.trim().toLowerCase();
      const users = await db.users.toArray();

      const matchedUser = users.find(
        (user) =>
          user.username?.toLowerCase() === enteredUsername ||
          user.email?.toLowerCase() === enteredUsername
      );

      if (!matchedUser) {
        throw new Error("Incorrect username or password.");
      }

      const authenticatedUser = await loginLocalUser(
        matchedUser.username,
        password
      );

      setUser(authenticatedUser);
      navigate("/", { replace: true });
    } catch (error) {
      setMessage(error.message || "Unable to login.");
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  };

  // ========================================
  // IMPORT EXISTING OWNER
  // ========================================

  const handleOwnerImport = async (e) => {
    const file = e.target.files?.[0];

    if (!file) return;

    setMessage("");
    setLoading(true);

    try {
      if (!file.name.toLowerCase().endsWith(".json")) {
        throw new Error("Please select a JSON export file.");
      }

      const ownerData = JSON.parse(await file.text());

      await importLegacyOwner(ownerData);

      setUsername(ownerData.username || "");

      setMessage(
        "OWNER account imported successfully. You can now sign in using your existing password."
      );

      setMessageType("success");
    } catch (error) {
      setMessage(error.message || "Unable to import OWNER account.");
      setMessageType("error");
    } finally {
      setLoading(false);
      e.target.value = "";
    }
  };

  // ========================================
  // IMPORT AIVEN MIGRATION
  // ========================================

  const handleMigrationImport = async (e) => {
    const file = e.target.files?.[0];

    if (!file) return;

    setMessage("");
    setLoading(true);

    try {
      if (!file.name.toLowerCase().endsWith(".json")) {
        throw new Error("Please select a JSON migration file.");
      }

      const migrationData = JSON.parse(await file.text());

      if (
        migrationData?.export_type !== "LOCAL_ONLY_MIGRATION" ||
        migrationData?.application !==
          "Miss Noori Cosmetics Management Software"
      ) {
        throw new Error("Invalid Miss Noori migration file.");
      }

      const counts = migrationData.counts || {};

      const confirmed = window.confirm(
        `Import Aiven data into this local database?\n\n` +
        `Areas: ${counts.areas ?? 0}\n` +
        `Shops: ${counts.shops ?? 0}\n` +
        `Balance Adjustments: ${counts.balance_adjustments ?? 0}\n` +
        `OWNER accounts: ${counts.owners ?? 0}\n\n` +
        `Existing local records will not be overwritten.\n\n` +
        `Continue?`
      );

      if (!confirmed) {
        setMessage("Migration import cancelled.");
        setMessageType("error");
        return;
      }

      const result = await importLocalMigration(migrationData);

      setMessage(
        `Migration completed successfully!\n\n` +
        `Areas imported: ${result.areas.imported}, skipped: ${result.areas.skipped}\n` +
        `Shops imported: ${result.shops.imported}, skipped: ${result.shops.skipped}\n` +
        `Adjustments imported: ${result.adjustments.imported}, skipped: ${result.adjustments.skipped}\n` +
        `OWNER accounts preserved: ${result.owners.preserved}`
      );

      setMessageType("success");
    } catch (error) {
      setMessage(
        error.message || "Migration import failed."
      );

      setMessageType("error");
    } finally {
      setLoading(false);
      e.target.value = "";
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <div className="login-logo">
            <Store size={30} />
          </div>

          <h1>Miss Noori</h1>
          <p>Business Management System</p>
        </div>

        <div className="login-heading">
          <h2>Welcome Back!</h2>
          <p>Sign in to manage your business.</p>
        </div>

        <form onSubmit={handleLogin}>
          <div className="login-field">
            <label>Username or Email</label>

            <input
              type="text"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </div>

          <div className="login-field">
            <label>Password</label>

            <div className="password-input">
              <LockKeyhole size={18} />

              <input
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />

              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={
                  showPassword ? "Hide password" : "Show password"
                }
              >
                {showPassword ? (
                  <EyeOff size={18} />
                ) : (
                  <Eye size={18} />
                )}
              </button>
            </div>
          </div>

          {message && (
            <p
              className="login-message"
              role="alert"
              style={{
                color:
                  messageType === "success"
                    ? "#16803c"
                    : undefined,
                whiteSpace: "pre-line",
              }}
            >
              {message}
            </p>
          )}

          <button
            type="submit"
            className="login-button"
            disabled={loading}
          >
            {loading ? "Please wait..." : "Sign In"}
          </button>
        </form>

        {/* OWNER IMPORT */}

        <div className="owner-import-section">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleOwnerImport}
            style={{ display: "none" }}
          />

          <button
            type="button"
            className="login-button"
            disabled={loading}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={17} style={{ marginRight: 8 }} />
            Import Existing OWNER Account
          </button>
        </div>

        {/* AIVEN MIGRATION IMPORT */}

        <div className="owner-import-section">
          <input
            ref={migrationInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleMigrationImport}
            style={{ display: "none" }}
          />

          <button
            type="button"
            className="login-button"
            disabled={loading}
            onClick={() => migrationInputRef.current?.click()}
          >
            <Database size={17} style={{ marginRight: 8 }} />
            {loading ? "Please wait..." : "Import Aiven Migration"}
          </button>
        </div>

        <div className="login-footer">
          <p>© 2026 Miss Noori. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}

export default Login;
