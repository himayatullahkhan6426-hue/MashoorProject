
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  Bell,
  Search,
  UserCircle,
  LogOut,
  Store,
  MapPin,
  Package,
  X,
  LoaderCircle,
} from "lucide-react";

import { apiRequest } from "../services/api";
import { useAuth } from "../context/AuthContext";

import "./Header.css";

const resultTypes = {
  shop: { label: "Shop", icon: Store },
  area: { label: "Area", icon: MapPin },
  product: { label: "Product", icon: Package },
};

export default function Header({ user }) {
  const navigate = useNavigate();
  const { setUser } = useAuth();

  const [loggingOut, setLoggingOut] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    const query = searchText.trim();

    if (query.length < 2) {
      setResults([]);
      setSearching(false);
      setSearchError("");
      return;
    }

    let cancelled = false;

    const timer = setTimeout(async () => {
      try {
        setSearching(true);
        setSearchError("");

        const data = await apiRequest(
          `/search?q=${encodeURIComponent(query)}`
        );

        if (!cancelled) {
          setResults(data.results || []);
          setShowResults(true);
        }
      } catch (error) {
        if (!cancelled) {
          setResults([]);
          setSearchError(error.message || "Search failed.");
        }
      } finally {
        if (!cancelled) {
          setSearching(false);
        }
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchText]);

  function openResult(item) {
    setShowResults(false);
    setSearchText("");
    setResults([]);

    switch (item.type) {
      case "shop":
        navigate(`/shops/${item.id}`);
        break;

      case "area":
        navigate(`/areas/${item.id}/shops`);
        break;

      case "product":
        navigate("/products");
        break;

      default:
        break;
    }
  }

  async function handleLogout() {
    try {
      setLoggingOut(true);

      await apiRequest("/auth/logout", {
        method: "POST",
      });

      setUser(null);
      navigate("/login", { replace: true });
    } catch (error) {
      alert(error.message || "Logout failed.");
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <header className="header">
      <div className="header-search-wrapper">
        <div className="search-box">
          <Search size={19} />

          <input
            type="search"
            placeholder="Search shops, areas, products..."
            value={searchText}
            onChange={(e) => {
              setSearchText(e.target.value);
              setShowResults(true);
            }}
            onFocus={() => {
              if (searchText.trim().length >= 2) {
                setShowResults(true);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setShowResults(false);
              }
            }}
          />

          {searching && (
            <LoaderCircle className="search-spinner" size={17} />
          )}

          {searchText && (
            <button
              type="button"
              className="search-clear"
              onClick={() => {
                setSearchText("");
                setResults([]);
                setShowResults(false);
              }}
              title="Clear search"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {showResults && searchText.trim().length >= 2 && (
          <div className="search-results">
            {searching && results.length === 0 && (
              <div className="search-message">
                Searching...
              </div>
            )}

            {!searching && searchError && (
              <div className="search-message search-error">
                {searchError}
              </div>
            )}

            {!searching && !searchError && results.length === 0 && (
              <div className="search-message">
                No results found.
              </div>
            )}

            {results.map((item) => {
              const config = resultTypes[item.type];
              const ResultIcon = config?.icon || Search;

              return (
                <button
                  type="button"
                  className="search-result-item"
                  key={`${item.type}-${item.id}`}
                  onClick={() => openResult(item)}
                >
                  <div className={`search-result-icon ${item.type}`}>
                    <ResultIcon size={18} />
                  </div>

                  <div className="search-result-content">
                    <strong>{item.title}</strong>
                    <span>{item.description || config?.label}</span>
                  </div>

                  <span className="search-result-type">
                    {config?.label}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="header-right">
        <button
          className="icon-button"
          type="button"
          title="Notifications"
        >
          <Bell size={20} />
        </button>

        <div className="profile">
          <UserCircle size={35} />

          <div>
            <strong>{user?.fullName || "User"}</strong>
            <span>{user?.role || ""}</span>
          </div>
        </div>

        <button
          className="icon-button"
          type="button"
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
