import {
  LayoutDashboard,
  MapPin,
  Store,
  Package,
  Truck,
  Wallet,
  History,
  BarChart3,
  Settings,
  Sparkles
} from "lucide-react";

import { NavLink } from "react-router-dom";

const menuItems = [
  { name: "Dashboard", path: "/", icon: LayoutDashboard },
  { name: "Villages & Towns", path: "/villages", icon: MapPin },
  { name: "Shops", path: "/shops", icon: Store },
  { name: "Products", path: "/products", icon: Package },
  { name: "Deliveries", path: "/deliveries", icon: Truck },
  { name: "Payments", path: "/payments", icon: Wallet },
  { name: "Transactions", path: "/transactions", icon: History },
  { name: "Reports", path: "/reports", icon: BarChart3 },
];

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-icon">
          <Sparkles size={25} />
        </div>
        <div>
          <h2>Miss Noori</h2>
          <span>Business Management</span>
        </div>
      </div>

      <p className="menu-label">MAIN MENU</p>

      <nav className="nav-menu">
        {menuItems.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/"}
              className={({ isActive }) =>
                isActive ? "nav-link active" : "nav-link"
              }
            >
              <Icon size={19} />
              <span>{item.name}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="sidebar-bottom">
        <NavLink to="/settings" className="nav-link">
          <Settings size={19} />
          <span>Settings</span>
        </NavLink>

        <div className="business-card">
          <Sparkles size={20} />
          <p>Miss Noori</p>
          <span>Cosmetics Distribution</span>
        </div>
      </div>
    </aside>
  );
}