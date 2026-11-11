
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
} from "react-router-dom";

import { AuthProvider, useAuth } from "./context/AuthContext";

import Sidebar from "./components/Sidebar";
import Header from "./components/Header";

import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import Areas from "./pages/Areas";
import Shops from "./pages/Shops";
import AreaShops from "./pages/AreaShops";
import ShopDashboard from "./pages/ShopDashboard";
import Documents from "./pages/Documents";

import "./index.css";

function ProtectedRoute() {
  const { unlocked, loading } = useAuth();

  if (loading) {
    return (
      <div className="auth-loading">
        Checking device security...
      </div>
    );
  }

  if (!unlocked) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

function MainLayout() {
  const { user } = useAuth();

  return (
    <div className="app-layout">
      <Sidebar />

      <main className="main-content">
        <Header user={user} />

        <div className="page-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<MainLayout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/areas" element={<Areas />} />
              <Route path="/shops" element={<Shops />} />
              <Route path="/shops/:shopId" element={<ShopDashboard />} />
              <Route path="/areas/:areaId/shops" element={<AreaShops />} />
              <Route path="/documents" element={<Documents />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
