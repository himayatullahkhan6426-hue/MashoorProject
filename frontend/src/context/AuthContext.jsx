import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

import { apiRequest } from "../services/api";

const AuthContext = createContext(null);

function getCachedUser() {
  try {
    const cached = localStorage.getItem("missnoori_user");
    return cached ? JSON.parse(cached) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getCachedUser);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(!navigator.onLine);

  function updateUser(nextUser) {
    setUser(nextUser);

    try {
      if (nextUser) {
        localStorage.setItem(
          "missnoori_user",
          JSON.stringify(nextUser)
        );
      } else {
        localStorage.removeItem("missnoori_user");
      }
    } catch (error) {
      console.error("User cache error:", error);
    }
  }

  useEffect(() => {
    let mounted = true;

    async function checkAuthentication() {
      try {
        const response = await apiRequest("/auth/me");

        if (mounted) {
          updateUser(response.user);
          setOffline(false);
        }
      } catch (error) {
        if (!mounted) return;

        if (!navigator.onLine) {
          setUser(getCachedUser());
          setOffline(true);
        } else {
          updateUser(null);
          setOffline(false);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    function handleOnline() {
      setOffline(false);
      checkAuthentication();
    }

    function handleOffline() {
      setOffline(true);
      setUser(getCachedUser());
    }

    checkAuthentication();

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      mounted = false;
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser: updateUser,
        loading,
        offline,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }

  return context;
}