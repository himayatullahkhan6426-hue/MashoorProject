
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LockKeyhole,
  Eye,
  EyeOff,
  Store,
} from "lucide-react";

import { apiRequest } from "../services/api";
import { useAuth } from "../context/AuthContext";
import "./Login.css";

const OFFLINE_KEY = "missnoori_offline_credentials";

async function hashPassword(password, salt) {
  const encoder = new TextEncoder();

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: 310000,
      hash: "SHA-256",
    },
    key,
    256
  );

  return Array.from(new Uint8Array(bits))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function saveOfflineCredentials(username, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await hashPassword(password, salt);

  localStorage.setItem(
    OFFLINE_KEY,
    JSON.stringify({
      username: username.trim().toLowerCase(),
      salt: Array.from(salt),
      hash,
    })
  );
}

async function verifyOfflineCredentials(username, password) {
  const saved = localStorage.getItem(OFFLINE_KEY);

  if (!saved) {
    throw new Error(
      "Offline login not configured. Please login once with internet."
    );
  }

  const credentials = JSON.parse(saved);

  if (
    credentials.username !== username.trim().toLowerCase()
  ) {
    return false;
  }

  const salt = new Uint8Array(credentials.salt);
  const hash = await hashPassword(password, salt);

  return hash === credentials.hash;
}

function Login() {
  const navigate = useNavigate();
  const { setUser } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();

    setMessage("");
    setLoading(true);

    try {
      if (!navigator.onLine) {
        const valid = await verifyOfflineCredentials(
          username,
          password
        );

        if (!valid) {
          throw new Error("Incorrect username or password.");
        }

        const cachedUser = localStorage.getItem("missnoori_user");

        if (!cachedUser) {
          throw new Error("Offline user profile not found.");
        }

        setUser(JSON.parse(cachedUser));
        navigate("/", { replace: true });
        return;
      }

      const data = await apiRequest("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          username,
          password,
        }),
      });

      if (!data.success || !data.user) {
        throw new Error("Login failed.");
      }

      await saveOfflineCredentials(username, password);

      setUser(data.user);
      navigate("/", { replace: true });

    } catch (error) {
      setMessage(error.message || "Unable to login.");
    } finally {
      setLoading(false);
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
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {message && (
            <p className="login-message" role="alert">
              {message}
            </p>
          )}

          <button
            type="submit"
            className="login-button"
            disabled={loading}
          >
            {loading
              ? "Signing in..."
              : navigator.onLine
                ? "Sign In"
                : "Sign In Offline"}
          </button>
        </form>

        <div className="login-footer">
          <p>© 2026 Miss Noori. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}

export default Login;
