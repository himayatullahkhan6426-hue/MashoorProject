
import {
  LayoutDashboard,
  MapPin,
  Store,
  Sparkles,
} from "lucide-react";

import { NavLink } from "react-router-dom";
import "./Sidebar.css";

const menuItems = [
  { name: "Dashboard", path: "/", icon: LayoutDashboard },
  { name: "Areas", path: "/areas", icon: MapPin },
  { name: "Add Shop", path: "/shops", icon: Store },
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
        <div className="business-card">
          <Sparkles size={20} />
          <p>Miss Noori</p>
          <span>Cosmetics Distribution</span>
        </div>
      </div>
    </aside>
  );
}
