
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
  Plus,
  X,
  Truck,
  FileText,
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
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentNotice, setPaymentNotice] = useState("");

  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    payment_date: new Date().toLocaleDateString("en-CA"),
    payment_method: "Cash",
    reference_number: "",
    notes: "",
  });

  async function loadDashboard() {
    try {
      setLoading(true);
      setError("");

      const response = await apiRequest(`/shops/${shopId}/dashboard`);
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

  function handlePaymentChange(event) {
    const { name, value } = event.target;

    setPaymentForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  function handlePaymentSubmit(event) {
    event.preventDefault();

    if (!paymentForm.amount || Number(paymentForm.amount) <= 0) {
      setPaymentNotice("Please enter a valid payment amount.");
      return;
    }

    // Frontend form only. Database integration comes in the next step.
    setPaymentNotice(
      "Payment form is ready. Database saving will be connected in the next step."
    );
  }

  function closePaymentForm() {
    setShowPaymentForm(false);
    setPaymentNotice("");
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

  const totalProducts = deliveries.reduce((total, delivery) => {
    return (
      total +
      (delivery.items || []).reduce(
        (itemTotal, item) => itemTotal + Number(item.quantity || 0),
        0
      )
    );
  }, 0);

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

      <section className="shop-quick-actions">
        <button
          className="shop-action-button delivery-action"
          onClick={() => navigate(`/shops/${shopId}/deliveries/new`)}
        >
          <Plus size={18} />
          New Delivery
        </button>

        <button
          className="shop-action-button payment-action"
          onClick={() => {
            setPaymentNotice("");
            setShowPaymentForm(true);
          }}
        >
          <Wallet size={18} />
          Record Payment
        </button>
      </section>

      <section className="shop-stat-grid">
        <div className="shop-stat-card products">
          <div className="shop-stat-icon">
            <Package size={22} />
          </div>
          <span>Total Products Delivered</span>
          <h2>{totalProducts.toLocaleString("en-PK")}</h2>
          <small>Across {deliveries.length} delivery records</small>
        </div>

        <div className="shop-stat-card sales">
          <div className="shop-stat-icon">
            <ShoppingBag size={22} />
          </div>
          <span>Total Sales</span>
          <h2>{money(shop.total_sales)}</h2>
          <small>Total value of deliveries</small>
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
                    <Truck size={20} />
                  </div>

                  <div className="history-item-details">
                    <strong>{delivery.invoice_number || "Delivery"}</strong>
                    <span>
                      <CalendarDays size={14} />
                      {formatDate(delivery.delivery_date)}
                    </span>
                    <small>
                      {(delivery.items || [])
                        .map(
                          (item) =>
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
                    <strong>{payment.payment_method || "Payment"}</strong>
                    <span>
                      <CalendarDays size={14} />
                      {formatDate(payment.payment_date)}
                    </span>
                    <small>
                      {payment.reference_number ||
                        payment.notes ||
                        "No reference"}
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

      {showPaymentForm && (
        <div className="payment-modal-overlay" onClick={closePaymentForm}>
          <div
            className="payment-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="payment-modal-header">
              <div>
                <span>SHOP ACCOUNT</span>
                <h2>Record Payment</h2>
                <p>{shop.shop_name}</p>
              </div>

              <button
                type="button"
                className="payment-close-button"
                onClick={closePaymentForm}
              >
                <X size={21} />
              </button>
            </div>

            <div className="payment-balance-info">
              <span>Current Outstanding Balance</span>
              <strong>{money(shop.outstanding_balance)}</strong>
            </div>

            <form onSubmit={handlePaymentSubmit}>
              <div className="payment-form-group">
                <label htmlFor="payment-amount">Payment Amount (Rs.) *</label>
                <input
                  id="payment-amount"
                  type="number"
                  name="amount"
                  min="0.01"
                  step="0.01"
                  placeholder="Enter amount"
                  value={paymentForm.amount}
                  onChange={handlePaymentChange}
                  required
                />
              </div>

              <div className="payment-form-row">
                <div className="payment-form-group">
                  <label htmlFor="payment-date">Payment Date *</label>
                  <input
                    id="payment-date"
                    type="date"
                    name="payment_date"
                    value={paymentForm.payment_date}
                    onChange={handlePaymentChange}
                    required
                  />
                </div>

                <div className="payment-form-group">
                  <label htmlFor="payment-method">Payment Method *</label>
                  <select
                    id="payment-method"
                    name="payment_method"
                    value={paymentForm.payment_method}
                    onChange={handlePaymentChange}
                    required
                  >
                    <option value="Cash">Cash</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="JazzCash">JazzCash</option>
                    <option value="Easypaisa">Easypaisa</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="payment-form-group">
                <label htmlFor="payment-reference">Reference Number</label>
                <input
                  id="payment-reference"
                  type="text"
                  name="reference_number"
                  placeholder="Transaction ID (optional)"
                  value={paymentForm.reference_number}
                  onChange={handlePaymentChange}
                />
              </div>

              <div className="payment-form-group">
                <label htmlFor="payment-notes">Notes</label>
                <textarea
                  id="payment-notes"
                  name="notes"
                  rows="3"
                  placeholder="Additional payment details..."
                  value={paymentForm.notes}
                  onChange={handlePaymentChange}
                />
              </div>

              {paymentNotice && (
                <div className="payment-form-notice">{paymentNotice}</div>
              )}

              <div className="payment-modal-actions">
                <button
                  type="button"
                  className="payment-cancel-button"
                  onClick={closePaymentForm}
                >
                  Cancel
                </button>

                <button type="submit" className="payment-submit-button">
                  <Wallet size={17} />
                  Continue
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
