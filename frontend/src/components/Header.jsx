import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  Search,
  UserCircle,
  LogOut,
} from "lucide-react";

import { apiRequest } from "../services/api";

export default function Header() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    async function loadUser() {
      try {
        const response = await apiRequest("/auth/me");
        setUser(response.user);
      } catch (error) {
        navigate("/login", { replace: true });
      }
    }

    loadUser();
  }, [navigate]);

  async function handleLogout() {
    try {
      setLoggingOut(true);

      await apiRequest("/auth/logout", {
        method: "POST",
      });

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
        <input placeholder="Search anything..." />
      </div>

      <div className="header-right">
        <button className="icon-button">
          <Bell size={20} />
        </button>

        <div className="profile">
          <UserCircle size={35} />

          <div>
            <strong>
              {user?.fullName || "Loading..."}
            </strong>

            <span>
              {user?.role || ""}
            </span>
          </div>
        </div>

        <button
          className="icon-button"
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