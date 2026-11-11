
import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

const AuthContext = createContext(null);

const STORAGE_KEY = "missnoori_user";

function getCachedUser() {
  try {
    const cached = sessionStorage.getItem(STORAGE_KEY);
    return cached ? JSON.parse(cached) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUserState] = useState(getCachedUser);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setUserState(getCachedUser());
    setLoading(false);
  }, []);

  function updateUser(nextUser) {
    setUserState(nextUser);

    try {
      if (nextUser) {
        sessionStorage.setItem(
          STORAGE_KEY,
          JSON.stringify(nextUser)
        );
      } else {
        sessionStorage.removeItem(STORAGE_KEY);
      }
    } catch (error) {
      console.error("Local session error:", error);
    }
  }

  function logout() {
    updateUser(null);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser: updateUser,
        loading,
        offline: true,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used inside AuthProvider."
    );
  }

  return context;
}
