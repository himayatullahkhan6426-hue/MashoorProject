import { Bell, Search, UserCircle } from "lucide-react";

export default function Header() {
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
            <strong>Administrator</strong>
            <span>Owner</span>
          </div>
        </div>
      </div>
    </header>
  );
}