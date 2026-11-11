
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
    const cached = sessionStorage.getItem("missnoori_user");
    return cached ? JSON.parse(cached) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getCachedUser);
  const [loading, setLoading] = useState(() => !getCachedUser());

  function updateUser(nextUser) {
    setUser(nextUser);

    try {
      if (nextUser) {
        sessionStorage.setItem(
          "missnoori_user",
          JSON.stringify(nextUser)
        );
      } else {
        sessionStorage.removeItem("missnoori_user");
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
        }
      } catch (error) {
        if (mounted) {
          updateUser(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    checkAuthentication();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser: updateUser,
        loading,
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
