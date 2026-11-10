
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  Bell,
  Search,
  UserCircle,
  LogOut,
} from "lucide-react";

import { apiRequest } from "../services/api";
import { useAuth } from "../context/AuthContext";

import "./Header.css";

export default function Header({ user }) {
  const navigate = useNavigate();
  const { setUser } = useAuth();

  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    try {
      setLoggingOut(true);

      await apiRequest("/auth/logout", {
        method: "POST",
      });

      setUser(null);
      navigate("/login", { replace: true });
    } catch (error) {
      alert(error.message || "Logout failed.");
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <header className="header">
      <div className="search-box">
        <Search size={19} />
        <input
          type="search"
          placeholder="Search anything..."
        />
      </div>

      <div className="header-right">
        <button
          className="icon-button"
          type="button"
          title="Notifications"
        >
          <Bell size={20} />
        </button>

        <div className="profile">
          <UserCircle size={35} />

          <div>
            <strong>
              {user?.fullName || "User"}
            </strong>

            <span>
              {user?.role || ""}
            </span>
          </div>
        </div>

        <button
          className="icon-button"
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          title="Logout"
        >
          <LogOut size={20} />
        </button>
      </div>
    </header>
  );
}
