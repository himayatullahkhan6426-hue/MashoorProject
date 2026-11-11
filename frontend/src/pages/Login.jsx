
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Eye,
  EyeOff,
  LockKeyhole,
  ShieldCheck,
  Store,
  ArrowLeft,
  KeyRound,
} from "lucide-react";

import {
  hasDevicePassword,
  setDevicePassword,
  verifyDevicePassword,
} from "../services/localAuth";

import { useAuth } from "../context/AuthContext";
import "./Login.css";

function Login() {
  const navigate = useNavigate();
  const { setDeviceUnlocked } = useAuth();

  const [mode, setMode] = useState("loading");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("error");

  useEffect(() => {
    async function checkPassword() {
      try {
        const exists = await hasDevicePassword();
        setMode(exists ? "unlock" : "welcome");
      } catch (error) {
        setMessage(error.message || "Something went wrong.");
        setMode("welcome");
      }
    }

    checkPassword();
  }, []);

  const clearFields = () => {
    setPassword("");
    setConfirmPassword("");
    setMessage("");
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  // UNLOCK
  const handleUnlock = async (e) => {
    e.preventDefault();

    if (!password || loading) return;

    setLoading(true);
    setMessage("");

    try {
      await verifyDevicePassword(password);

      setDeviceUnlocked(true);
      navigate("/", { replace: true });
    } catch (error) {
      setMessage(error.message || "Incorrect password. Try again.");
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  };

  // SET OR RESET PASSWORD
  const handleSavePassword = async (e) => {
    e.preventDefault();

    if (loading) return;

    if (password.length < 8) {
      setMessage("Password must be at least 8 characters.");
      setMessageType("error");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      setMessageType("error");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      await setDevicePassword(password);

      setDeviceUnlocked(true);
      navigate("/", { replace: true });
    } catch (error) {
      setMessage(error.message || "Unable to save password.");
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  };

  const openSetup = () => {
    clearFields();
    setMode("setup");
  };

  const openForgotPassword = () => {
    clearFields();
    setMode("forgot");
  };

  const goBack = () => {
    clearFields();
    setMode("unlock");
  };

  const isPasswordForm = mode === "setup" || mode === "forgot";

  return (
    <div className="login-page">
      <div className="login-background-shape login-shape-one" />
      <div className="login-background-shape login-shape-two" />
      <div className="login-background-shape login-shape-three" />

      <div className="login-card">

        {/* BRAND */}

        <div className="login-brand">
          <div className="login-logo">
            <Store size={31} strokeWidth={1.8} />
          </div>

          <h1>Miss Noori</h1>
          <p>BUSINESS MANAGEMENT SYSTEM</p>
        </div>

        <div className="login-divider" />

        {/* LOADING */}

        {mode === "loading" && (
          <div className="login-loading">
            <span className="login-spinner" />
            <p>Please wait...</p>
          </div>
        )}

        {/* FIRST TIME SETUP */}

        {mode === "welcome" && (
          <div className="login-first-time">
            <div className="login-security-icon">
              <ShieldCheck size={25} />
            </div>

            <h2>Protect Your Business</h2>

            <p>
              Set a password to access your business software.
            </p>

            <button
              type="button"
              className="login-primary-button"
              onClick={openSetup}
            >
              <LockKeyhole size={19} />
              Set Password
            </button>
          </div>
        )}

        {/* NORMAL LOGIN */}

        {mode === "unlock" && (
          <>
            <div className="login-heading">
              <div className="login-security-icon">
                <LockKeyhole size={23} />
              </div>

              <h2>Enter Password</h2>
              <p>Enter your password to continue.</p>
            </div>

            <form onSubmit={handleUnlock} className="login-form">
              <div className="login-field">
                <label htmlFor="device-password">
                  Password
                </label>

                <div className="password-input">
                  <LockKeyhole
                    size={19}
                    className="password-lock-icon"
                  />

                  <input
                    id="device-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    autoFocus
                    required
                  />

                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label="Toggle password visibility"
                  >
                    {showPassword ? (
                      <EyeOff size={19} />
                    ) : (
                      <Eye size={19} />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="button"
                className="login-forgot-button"
                onClick={openForgotPassword}
              >
                Forgot Password?
              </button>

              <button
                type="submit"
                className="login-primary-button"
                disabled={loading || !password}
              >
                {loading ? (
                  <>
                    <span className="login-button-spinner" />
                    Please wait...
                  </>
                ) : (
                  <>
                    <LockKeyhole size={19} />
                    Enter
                  </>
                )}
              </button>
            </form>
          </>
        )}

        {/* SETUP / FORGOT PASSWORD */}

        {isPasswordForm && (
          <>
            <div className="login-heading">
              <div className="login-security-icon">
                {mode === "forgot" ? (
                  <KeyRound size={23} />
                ) : (
                  <ShieldCheck size={23} />
                )}
              </div>

              <h2>
                {mode === "forgot"
                  ? "Reset Password"
                  : "Set Password"}
              </h2>

              <p>
                {mode === "forgot"
                  ? "Create a new password to continue."
                  : "Create a password for your device."}
              </p>
            </div>

            <form
              onSubmit={handleSavePassword}
              className="login-form"
            >
              <div className="login-field">
                <label htmlFor="new-device-password">
                  New Password
                </label>

                <div className="password-input">
                  <LockKeyhole
                    size={19}
                    className="password-lock-icon"
                  />

                  <input
                    id="new-device-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter new password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    autoFocus
                    minLength={8}
                    required
                  />

                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label="Toggle password visibility"
                  >
                    {showPassword ? (
                      <EyeOff size={19} />
                    ) : (
                      <Eye size={19} />
                    )}
                  </button>
                </div>

                <small className="login-field-hint">
                  Minimum 8 characters
                </small>
              </div>

              <div className="login-field">
                <label htmlFor="confirm-device-password">
                  Confirm Password
                </label>

                <div className="password-input">
                  <LockKeyhole
                    size={19}
                    className="password-lock-icon"
                  />

                  <input
                    id="confirm-device-password"
                    type={
                      showConfirmPassword ? "text" : "password"
                    }
                    placeholder="Enter password again"
                    value={confirmPassword}
                    onChange={(e) =>
                      setConfirmPassword(e.target.value)
                    }
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />

                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() =>
                      setShowConfirmPassword(!showConfirmPassword)
                    }
                    aria-label="Toggle confirmation visibility"
                  >
                    {showConfirmPassword ? (
                      <EyeOff size={19} />
                    ) : (
                      <Eye size={19} />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="login-primary-button"
                disabled={
                  loading || !password || !confirmPassword
                }
              >
                {loading ? (
                  <>
                    <span className="login-button-spinner" />
                    Saving Password...
                  </>
                ) : (
                  <>
                    <ShieldCheck size={19} />
                    {mode === "forgot"
                      ? "Reset Password"
                      : "Set Password"}
                  </>
                )}
              </button>

              <button
                type="button"
                className="login-back-button"
                onClick={goBack}
                disabled={loading}
              >
                <ArrowLeft size={17} />
                Back
              </button>
            </form>
          </>
        )}

        {/* MESSAGE */}

        {message && (
          <div className={`login-message ${messageType}`}>
            {message}
          </div>
        )}

        {/* FOOTER */}

        <div className="login-footer">
          <div className="login-footer-security">
            <ShieldCheck size={15} />
            <span>Local Device Access</span>
          </div>

          <p>© 2026 Miss Noori. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}

export default Login;
