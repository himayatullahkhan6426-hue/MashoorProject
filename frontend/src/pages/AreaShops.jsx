import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Store,
  Search,
  MapPin,
  Phone,
  MessageCircle,
  Plus,
  RefreshCw,
} from "lucide-react";

import { apiRequest } from "../services/api";
import "./AreaShops.css";

export default function AreaShops() {
  const { areaId } = useParams();
  const navigate = useNavigate();

  const [area, setArea] = useState(null);
  const [shops, setShops] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const [areasResponse, shopsResponse] = await Promise.all([
        apiRequest("/areas"),
        apiRequest(`/shops?area_id=${areaId}`),
      ]);

      const selectedArea = (areasResponse.areas || []).find(
        (item) => String(item.id) === String(areaId)
      );

      setArea(selectedArea || null);
      setShops(shopsResponse.shops || []);
    } catch (err) {
      setError(err.message || "Unable to load area information.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [areaId]);

  const filteredShops = shops.filter((shop) =>
    `${shop.shop_name} ${shop.owner_name || ""} ${shop.phone || ""}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  function getWhatsAppLink(number) {
    if (!number) return null;

    let phone = number.replace(/\D/g, "");

    if (phone.startsWith("03")) {
      phone = "92" + phone.substring(1);
    } else if (phone.startsWith("3")) {
      phone = "92" + phone;
    }

    return `https://wa.me/${phone}`;
  }

  if (loading) {
    return <div className="area-shops-message">Loading shops...</div>;
  }

  if (!area) {
    return (
      <div className="area-shops-message">
        <h2>Area not found</h2>
        <button onClick={() => navigate("/areas")}>
          Back to Areas
        </button>
      </div>
    );
  }

  return (
    <div className="area-shops-page">

      <button
        className="area-back-btn"
        onClick={() => navigate("/areas")}
      >
        <ArrowLeft size={18} /> Back to Areas
      </button>

      <div className="area-shops-heading">
        <div>
          <div className="area-title-label">
            <MapPin size={16} /> {area.area_type}
          </div>

          <h1>{area.name}</h1>

          <p>
            {area.district || "No district specified"} ·
            {" "}{shops.length} registered shops
          </p>
        </div>

        <button
          className="area-add-shop-btn"
          onClick={() => navigate("/shops")}
        >
          <Plus size={18} /> Manage Shops
        </button>
      </div>

      {error && (
        <div className="area-shops-error">{error}</div>
      )}

      <div className="area-shops-toolbar">
        <div className="area-shops-search">
          <Search size={19} />
          <input
            placeholder="Search shops in this area..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <button
          className="area-refresh-btn"
          onClick={loadData}
        >
          <RefreshCw size={17} /> Refresh
        </button>
      </div>

      {filteredShops.length === 0 ? (
        <div className="area-shops-empty">
          <Store size={42} />
          <h3>No shops found</h3>
          <p>
            {search
              ? "Try another search."
              : "There are no registered shops in this area yet."}
          </p>
        </div>
      ) : (
        <div className="area-shop-grid">
          {filteredShops.map((shop) => (
            <div
              className="area-shop-card"
              key={shop.id}
              onClick={() => navigate(`/shops/${shop.id}`)}
            >
              <div className="area-shop-card-top">
                <div className="area-shop-icon">
                  <Store size={23} />
                </div>

                <span className="area-shop-status">Active</span>
              </div>

              <h3>{shop.shop_name}</h3>

              <p className="area-shop-owner">
                Owner: {shop.owner_name || "Not provided"}
              </p>

              <div className="area-shop-contact">
                <Phone size={15} />
                <span>{shop.phone || "No phone number"}</span>
              </div>

              <div className="area-shop-card-footer">
                <span>View Shop Dashboard</span>
                <ArrowLeft className="area-shop-arrow" size={17} />
              </div>

              {getWhatsAppLink(shop.whatsapp_number || shop.phone) && (
                <a
                  className="area-shop-whatsapp"
                  href={getWhatsAppLink(
                    shop.whatsapp_number || shop.phone
                  )}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  title="Contact on WhatsApp"
                >
                  <MessageCircle size={17} />
                </a>
              )}
            </div>
          ))}
        </div>
      )}

    </div>
  );
}