
import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

const AuthContext = createContext(null);

const STORAGE_KEY = "missnoori_device_unlocked";

const DEVICE_USER = {
  id: "local-device",
  fullName: "Local Device",
  username: "local-device",
  role: "LOCAL_DEVICE",
  is_active: true,
};

export function AuthProvider({ children }) {
  const [unlocked, setUnlocked] = useState(
    () => sessionStorage.getItem(STORAGE_KEY) === "true"
  );

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Remove the previous account-based session.
    sessionStorage.removeItem("missnoori_user");

    setLoading(false);
  }, []);

  function setDeviceUnlocked(value) {
    const nextValue = Boolean(value);

    setUnlocked(nextValue);

    if (nextValue) {
      sessionStorage.setItem(STORAGE_KEY, "true");
    } else {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  }

  function logout() {
    setDeviceUnlocked(false);
  }

  // Compatibility with existing components using user.
  const user = unlocked ? DEVICE_USER : null;

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser: (value) => setDeviceUnlocked(Boolean(value)),
        unlocked,
        setDeviceUnlocked,
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
