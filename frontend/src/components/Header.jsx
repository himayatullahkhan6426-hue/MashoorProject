
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  Bell,
  Search,
  UserCircle,
  LogOut,
  Store,
  MapPin,
  X,
  LoaderCircle,
} from "lucide-react";

import db from "../database/localDb";
import { useAuth } from "../context/AuthContext";

import "./Header.css";

const resultTypes = {
  shop: { label: "Shop", icon: Store },
  area: { label: "Area", icon: MapPin },
};

// ==========================================
// LOCAL SEARCH
// ==========================================

async function searchLocalData(query) {
  const [shops, areas] = await Promise.all([
    db.shops.toArray(),
    db.areas.toArray(),
  ]);

  const search = query.toLowerCase();

  const shopResults = shops
    .filter((shop) => shop.is_active !== false)
    .filter((shop) => {
      const searchable = [
        shop.shop_name,
        shop.owner_name,
        shop.phone,
        shop.whatsapp_number,
        shop.area_name,
        shop.address,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(search);
    })
    .map((shop) => ({
      id: shop.id,
      type: "shop",
      title: shop.shop_name,
      description:
        shop.owner_name || shop.area_name || "Registered shop",
    }));

  const areaResults = areas
    .filter((area) => area.is_active !== false)
    .filter((area) => {
      const searchable = [
        area.name,
        area.area_type,
        area.district,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(search);
    })
    .map((area) => ({
      id: area.id,
      type: "area",
      title: area.name,
      description:
        [area.area_type, area.district]
          .filter(Boolean)
          .join(" • ") || "Registered area",
    }));

  return [...shopResults, ...areaResults].slice(0, 20);
}

// ==========================================
// HEADER
// ==========================================

export default function Header({ user }) {
  const navigate = useNavigate();
  const { setUser } = useAuth();

  const [loggingOut, setLoggingOut] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [showResults, setShowResults] = useState(false);

  // ========================================
  // LOCAL SEARCH EFFECT
  // ========================================

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

        const localResults = await searchLocalData(query);

        if (!cancelled) {
          setResults(localResults);
          setShowResults(true);
        }
      } catch (error) {
        console.error("Local search error:", error);

        if (!cancelled) {
          setResults([]);
          setSearchError("Unable to search local data.");
        }
      } finally {
        if (!cancelled) {
          setSearching(false);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchText]);

  // ========================================
  // OPEN SEARCH RESULT
  // ========================================

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

      default:
        break;
    }
  }

  // ========================================
  // LOCAL LOGOUT
  // ========================================

  function handleLogout() {
    try {
      setLoggingOut(true);

      // Clear local session. No server request.
      setUser(null);

      navigate("/login", { replace: true });
    } catch (error) {
      console.error("Local logout error:", error);
      alert("Unable to logout.");
    } finally {
      setLoggingOut(false);
    }
  }

  // ========================================
  // UI
  // ========================================

  return (
    <header className="header">
      <div className="header-search-wrapper">
        <div className="search-box">
          <Search size={19} />

          <input
            type="search"
            placeholder="Search shops, areas..."
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
            <LoaderCircle
              className="search-spinner"
              size={17}
            />
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

            {!searching &&
              !searchError &&
              results.length === 0 && (
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
                  <div
                    className={`search-result-icon ${item.type}`}
                  >
                    <ResultIcon size={18} />
                  </div>

                  <div className="search-result-content">
                    <strong>{item.title}</strong>
                    <span>
                      {item.description || config?.label}
                    </span>
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
