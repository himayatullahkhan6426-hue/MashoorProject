import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Store,
  Phone,
  MapPin,
  MessageCircle,
  ShoppingBag,
  Wallet,
  CreditCard,
  Receipt,
  RefreshCw,
  CalendarDays,
  Package,
} from "lucide-react";

import { apiRequest } from "../services/api";
import "./ShopDashboard.css";

export default function ShopDashboard() {
  const { shopId } = useParams();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState("deliveries");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadDashboard() {
    try {
      setLoading(true);
      setError("");

      const response = await apiRequest(
        `/shops/${shopId}/dashboard`
      );

      setData(response);
    } catch (err) {
      setError(err.message || "Unable to load shop dashboard.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, [shopId]);

  function money(value) {
    return `Rs. ${Number(value || 0).toLocaleString("en-PK", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  function formatDate(date) {
    return date
      ? new Date(date).toLocaleDateString("en-PK", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : "—";
  }

  if (loading) {
    return (
      <div className="shop-loading">
        <RefreshCw className="spin" size={28} />
        <p>Loading shop dashboard...</p>
      </div>
    );
  }

  if (error || !data?.shop) {
    return (
      <div className="shop-error">
        <Store size={35} />
        <h2>Unable to load shop</h2>
        <p>{error || "Shop not found."}</p>
        <button onClick={() => navigate(-1)}>Go Back</button>
      </div>
    );
  }

  const shop = data.shop;
  const deliveries = data.deliveries || [];
  const payments = data.payments || [];

  const whatsappNumber = (shop.whatsapp_number || shop.phone || "")
    .replace(/\D/g, "");

  const whatsappLink = whatsappNumber
    ? `https://wa.me/${whatsappNumber}`
    : null;

  return (
    <div className="shop-dashboard">
      <button className="shop-back-button" onClick={() => navigate(-1)}>
        <ArrowLeft size={18} />
        Back to Shops
      </button>

      {/* Shop Information */}
      <section className="shop-profile-card">
        <div className="shop-profile-icon">
          <Store size={32} />
        </div>

        <div className="shop-profile-info">
          <span className="shop-label">SHOP ACCOUNT</span>
          <h1>{shop.shop_name}</h1>
          <p>{shop.area_name || "Area not available"}</p>

          <div className="shop-contact-details">
            <span>
              <Phone size={15} />
              {shop.phone || "No phone number"}
            </span>

            <span>
              <MapPin size={15} />
              {shop.address || "No address"}
            </span>

            <span>
              <Store size={15} />
              {shop.owner_name || "Owner not specified"}
            </span>
          </div>
        </div>

        {whatsappLink && (
          <a
            className="shop-whatsapp-button"
            href={whatsappLink}
            target="_blank"
            rel="noreferrer"
          >
            <MessageCircle size={18} />
            WhatsApp
          </a>
        )}
      </section>

      {/* Account Statistics */}
      <section className="shop-stat-grid">
        <div className="shop-stat-card sales">
          <div className="shop-stat-icon">
            <ShoppingBag size={22} />
          </div>
          <span>Total Deliveries</span>
          <h2>{money(shop.total_sales)}</h2>
          <small>{shop.delivery_count || 0} delivery records</small>
        </div>

        <div className="shop-stat-card payments">
          <div className="shop-stat-icon">
            <Wallet size={22} />
          </div>
          <span>Total Payments</span>
          <h2>{money(shop.total_payments)}</h2>
          <small>{shop.payment_count || 0} payment records</small>
        </div>

        <div className="shop-stat-card balance">
          <div className="shop-stat-icon">
            <CreditCard size={22} />
          </div>
          <span>Outstanding Balance</span>
          <h2>{money(shop.outstanding_balance)}</h2>
          <small>Current shop balance</small>
        </div>
      </section>

      {/* History */}
      <section className="shop-history-section">
        <div className="shop-history-header">
          <div>
            <h2>Account History</h2>
            <p>Complete financial activity for this shop</p>
          </div>

          <button onClick={loadDashboard}>
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>

        <div className="shop-history-tabs">
          <button
            className={activeTab === "deliveries" ? "active" : ""}
            onClick={() => setActiveTab("deliveries")}
          >
            <Package size={17} />
            Deliveries ({deliveries.length})
          </button>

          <button
            className={activeTab === "payments" ? "active" : ""}
            onClick={() => setActiveTab("payments")}
          >
            <Receipt size={17} />
            Payments ({payments.length})
          </button>
        </div>

        {activeTab === "deliveries" && (
          <div className="shop-history-list">
            {deliveries.length === 0 ? (
              <div className="shop-empty">
                <Package size={35} />
                <p>No deliveries recorded yet.</p>
              </div>
            ) : (
              deliveries.map((delivery) => (
                <div className="shop-history-item" key={delivery.id}>
                  <div className="history-item-icon delivery-icon">
                    <ShoppingBag size={20} />
                  </div>

                  <div className="history-item-details">
                    <strong>{delivery.invoice_number}</strong>
                    <span>
                      <CalendarDays size={14} />
                      {formatDate(delivery.delivery_date)}
                    </span>

                    <small>
                      {(delivery.items || [])
                        .map((item) =>
                          `${item.product_name} × ${item.quantity}`
                        )
                        .join(", ")}
                    </small>
                  </div>

                  <div className="history-item-amount">
                    <strong>{money(delivery.total_amount)}</strong>
                    <span>Delivery</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "payments" && (
          <div className="shop-history-list">
            {payments.length === 0 ? (
              <div className="shop-empty">
                <Wallet size={35} />
                <p>No payments recorded yet.</p>
              </div>
            ) : (
              payments.map((payment) => (
                <div className="shop-history-item" key={payment.id}>
                  <div className="history-item-icon payment-icon">
                    <Wallet size={20} />
                  </div>

                  <div className="history-item-details">
                    <strong>
                      {payment.payment_method || "Payment"}
                    </strong>
                    <span>
                      <CalendarDays size={14} />
                      {formatDate(payment.payment_date)}
                    </span>
                    <small>
                      {payment.reference_number || payment.notes || "No reference"}
                    </small>
                  </div>

                  <div className="history-item-amount payment-amount">
                    <strong>{money(payment.amount)}</strong>
                    <span>Received</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </section>
    </div>
  );
}