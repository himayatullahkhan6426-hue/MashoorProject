import { useEffect, useState } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import Sidebar from "./components/Sidebar";
import Header from "./components/Header";

import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import Areas from "./pages/Areas";
import Shops from "./pages/Shops";
import Products from "./pages/Products";
import AreaShops from "./pages/AreaShops";
import ShopDashboard from "./pages/ShopDashboard";

import { apiRequest } from "./services/api";
import "./index.css";

// Protected Route
function ProtectedRoute({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkAuthentication() {
      try {
        const response = await apiRequest("/auth/me");
        setUser(response.user);
      } catch (error) {
        setUser(null);
      } finally {
        setLoading(false);
      }
    }

    checkAuthentication();
  }, []);

  if (loading) {
    return <div>Checking authentication...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

// Main Application Layout
function MainLayout({ children }) {
  return (
    <div className="app-layout">
      <Sidebar />

      <main className="main-content">
        <Header />

        <div className="page-content">
          {children}
        </div>
      </main>
    </div>
  );
}

// Application Routes
function App() {
  return (
    <BrowserRouter>
      <Routes>

        <Route path="/login" element={<Login />} />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <MainLayout>
                <Dashboard />
              </MainLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/areas"
          element={
            <ProtectedRoute>
              <MainLayout>
                <Areas />
              </MainLayout>
            </ProtectedRoute>
          }
        />

        <Route path="/shops/:shopId" element={<ShopDashboard />} />

        <Route
          path="/shops"
          element={
            <ProtectedRoute>
              <MainLayout>
                <Shops />
              </MainLayout>
            </ProtectedRoute>
          }
        />

        <Route
  path="/products"
  element={
    <ProtectedRoute>
      <MainLayout>
        <Products />
      </MainLayout>
    </ProtectedRoute>
  }
/>

         <Route
  path="/areas/:areaId/shops"
  element={
    <ProtectedRoute>
      <MainLayout>
        <AreaShops />
      </MainLayout>
    </ProtectedRoute>
  }
/>







        <Route
          path="*"
          element={<Navigate to="/" replace />}
        />

      </Routes>
    </BrowserRouter>
  );
}

export default App;