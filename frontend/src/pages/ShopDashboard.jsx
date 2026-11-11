import { useEffect, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Store,
  Phone,
  MapPin,
  MessageCircle,
  Plus,
  Minus,
  X,
  RefreshCw,
  CalendarDays,
  History,
  Wifi,
  WifiOff,
} from "lucide-react";

import { apiRequest } from "../services/api";
import "./ShopDashboard.css";

const emptyForm = {
  amount: "",
  reason: "",
  adjustment_date: new Date().toLocaleDateString("en-CA"),
};

function formatMoney(value) {
  return `Rs. ${Number(value || 0).toLocaleString("en-PK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function getWhatsAppLink(number) {
  let digits = String(number || "").replace(/\D/g, "");

  if (digits.startsWith("03")) {
    digits = `92${digits.slice(1)}`;
  } else if (digits.startsWith("3")) {
    digits = `92${digits}`;
  }

  return digits ? `https://wa.me/${digits}` : null;
}

export default function ShopDashboard() {
  const navigate = useNavigate();
  const { shopId } = useParams();

  const [shop, setShop] = useState(null);
  const [adjustments, setAdjustments] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);

  const [showForm, setShowForm] = useState(false);
  const [adjustmentType, setAdjustmentType] = useState("ADD");
  const [form, setForm] = useState(emptyForm);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await apiRequest(
        `/shops/${shopId}/dashboard`
      );

      setShop(response.shop);
      setAdjustments(response.adjustments || []);
    } catch (err) {
      setError(
        err.message || "Unable to load shop information."
      );
    } finally {
      setLoading(false);
    }
  }, [shopId]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    function handleOnline() {
      setOnline(true);
      loadDashboard();
    }

    function handleOffline() {
      setOnline(false);
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [loadDashboard]);

  function openAdjustment(type) {
    setAdjustmentType(type);
    setForm({
      ...emptyForm,
      adjustment_date: new Date().toLocaleDateString("en-CA"),
    });
    setError("");
    setNotice("");
    setShowForm(true);
  }

  function closeForm() {
    if (saving) return;
    setShowForm(false);
    setForm(emptyForm);
  }

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const amount = Number(form.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter a valid amount greater than zero.");
      return;
    }

    if (!form.reason.trim()) {
      setError("Please enter a reason.");
      return;
    }

    if (!navigator.onLine) {
      setError(
        "Offline adjustment storage is not implemented yet. Please wait for the offline sync feature."
      );
      return;
    }

    try {
      setSaving(true);
      setError("");

      await apiRequest(`/shops/${shopId}/adjustments`, {
        method: "POST",
        body: JSON.stringify({
          adjustment_type: adjustmentType,
          amount,
          reason: form.reason.trim(),
          adjustment_date: form.adjustment_date,
        }),
      });

      setShowForm(false);
      setForm(emptyForm);

      setNotice(
        adjustmentType === "ADD"
          ? "Balance added successfully."
          : "Balance subtracted successfully."
      );

      await loadDashboard();
    } catch (err) {
      setError(
        err.message || "Unable to save balance adjustment."
      );
    } finally {
      setSaving(false);
    }
  }

  const openingBalance = Number(shop?.opening_balance || 0);

  const totalAdded = adjustments
    .filter((item) => item.adjustment_type === "ADD")
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);

  const totalSubtracted = adjustments
    .filter((item) => item.adjustment_type === "SUBTRACT")
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);

  const totalUnpaid =
    openingBalance + totalAdded - totalSubtracted;

  const whatsappLink = getWhatsAppLink(
    shop?.whatsapp_number || shop?.phone
  );

  if (loading && !shop) {
    return (
      <div className="shop-loading">
        <RefreshCw className="spin" size={28} />
        <p>Loading shop information...</p>
      </div>
    );
  }

  if (!shop) {
    return (
      <div className="shop-error">
        <p>{error || "Shop information not available."}</p>
        <button onClick={() => navigate("/shops")}>
          Back to Shops
        </button>
        <button onClick={loadDashboard}>
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="shop-dashboard">

      <button
        className="shop-back-button"
        onClick={() => navigate("/shops")}
      >
        <ArrowLeft size={17} />
        Back to Shops
      </button>

      <div className="shop-sync-status">
        {online ? (
          <>
            <Wifi size={16} />
            <span>Online — Connected</span>
          </>
        ) : (
          <>
            <WifiOff size={16} />
            <span>Offline — Local storage not connected yet</span>
          </>
        )}
      </div>

      {notice && (
        <div className="shop-notice">
          {notice}
          <button onClick={() => setNotice("")}>
            <X size={16} />
          </button>
        </div>
      )}

      {error && (
        <div className="shop-error-message">
          {error}
        </div>
      )}

      {/* SHOP PROFILE */}
      <section className="shop-profile-card">
        <div className="shop-profile-icon">
          <Store size={32} />
        </div>

        <div className="shop-profile-info">
          <span className="shop-label">SHOP ACCOUNT</span>
          <h1>{shop.shop_name}</h1>
          <p>{shop.owner_name || "Owner not specified"}</p>

          <div className="shop-contact-details">
            {shop.phone && (
              <span>
                <Phone size={14} />
                {shop.phone}
              </span>
            )}

            {shop.area_name && (
              <span>
                <MapPin size={14} />
                {shop.area_name}
              </span>
            )}

            {shop.address && (
              <span>
                <MapPin size={14} />
                {shop.address}
              </span>
            )}
          </div>
        </div>

        {whatsappLink && (
          <a
            href={whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            className="shop-whatsapp-button"
          >
            <MessageCircle size={17} />
            WhatsApp
          </a>
        )}
      </section>

      {/* BALANCE ACTIONS */}
      <div className="shop-quick-actions">
        <button
          className="shop-action-button adjustment-action"
          onClick={() => openAdjustment("ADD")}
        >
          <Plus size={18} />
          Add Balance
        </button>

        <button
          className="shop-action-button subtract-action"
          onClick={() => openAdjustment("SUBTRACT")}
        >
          <Minus size={18} />
          Subtract Balance
        </button>
      </div>

      {/* BALANCE STATISTICS */}
      <section className="shop-stat-grid">

        <div className="shop-stat-card opening">
          <div className="shop-stat-icon">
            <Store size={21} />
          </div>
          <span>Opening Balance</span>
          <h2>{formatMoney(openingBalance)}</h2>
          <small>Initial shop balance</small>
        </div>

        <div className="shop-stat-card added">
          <div className="shop-stat-icon">
            <Plus size={21} />
          </div>
          <span>Total Added</span>
          <h2>{formatMoney(totalAdded)}</h2>
          <small>All balance additions</small>
        </div>

        <div className="shop-stat-card subtracted">
          <div className="shop-stat-icon">
            <Minus size={21} />
          </div>
          <span>Total Subtracted</span>
          <h2>{formatMoney(totalSubtracted)}</h2>
          <small>All balance subtractions</small>
        </div>

        <div className="shop-stat-card balance">
          <div className="shop-stat-icon">
            <History size={21} />
          </div>
          <span>Total Unpaid</span>
          <h2>{formatMoney(totalUnpaid)}</h2>
          <small>Current remaining balance</small>
        </div>

      </section>

      {/* ADJUSTMENT HISTORY */}
      <section className="shop-history-section">

        <div className="shop-history-header">
          <div>
            <h2>Balance Adjustment History</h2>
            <p>Complete record of additions and subtractions.</p>
          </div>

          <button
            onClick={loadDashboard}
            disabled={loading}
          >
            <RefreshCw
              size={16}
              className={loading ? "spin" : ""}
            />
            Refresh
          </button>
        </div>

        <div className="adjustment-summary">

          <div>
            <span>Opening Balance</span>
            <strong>{formatMoney(openingBalance)}</strong>
          </div>

          <div>
            <span>Total Added</span>
            <strong>{formatMoney(totalAdded)}</strong>
          </div>

          <div>
            <span>Total Subtracted</span>
            <strong>{formatMoney(totalSubtracted)}</strong>
          </div>

        </div>

        <div className="shop-history-list">

          {adjustments.length === 0 ? (
            <div className="shop-empty">
              <History size={35} />
              <p>No balance adjustments found.</p>
            </div>
          ) : (
            adjustments.map((item) => {
              const isAdd =
                item.adjustment_type === "ADD";

              return (
                <div
                  className="shop-history-item"
                  key={item.id}
                >
                  <div
                    className={`history-item-icon ${
                      isAdd
                        ? "adjustment-add-icon"
                        : "adjustment-subtract-icon"
                    }`}
                  >
                    {isAdd ? (
                      <Plus size={20} />
                    ) : (
                      <Minus size={20} />
                    )}
                  </div>

                  <div className="history-item-details">
                    <strong>
                      Balance {isAdd ? "Added" : "Subtracted"}
                    </strong>

                    <span>
                      <CalendarDays size={13} />
                      {new Date(
                        item.adjustment_date
                      ).toLocaleDateString("en-PK")}
                    </span>

                    {item.reason && (
                      <small>{item.reason}</small>
                    )}
                  </div>

                  <div className="history-item-amount">
                    <strong className={isAdd ? "amount-add" : "amount-subtract"}>
                      {isAdd ? "+" : "-"}
                      {formatMoney(item.amount)}
                    </strong>

                    <span>
                      {isAdd ? "Added" : "Subtracted"}
                    </span>
                  </div>
                </div>
              );
            })
          )}

        </div>
      </section>

      {/* ADD / SUBTRACT MODAL */}
      {showForm && (
        <div
          className="payment-modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeForm();
            }
          }}
        >
          <div className="payment-modal">

            <div className="payment-modal-header">
              <div>
                <span>BALANCE ADJUSTMENT</span>

                <h2>
                  {adjustmentType === "ADD"
                    ? "Add Balance"
                    : "Subtract Balance"}
                </h2>

                <p>{shop.shop_name}</p>
              </div>

              <button
                className="payment-close-button"
                onClick={closeForm}
                disabled={saving}
              >
                <X size={20} />
              </button>
            </div>

            <div className="payment-balance-info">
              <span>Current Unpaid Balance</span>
              <strong>{formatMoney(totalUnpaid)}</strong>
            </div>

            <form onSubmit={handleSubmit}>

              <div className="payment-form-group">
                <label>Amount (Rs.) *</label>
                <input
                  type="number"
                  name="amount"
                  min="0.01"
                  step="0.01"
                  value={form.amount}
                  onChange={handleChange}
                  placeholder="Enter amount"
                  required
                />
              </div>

              <div className="payment-form-group">
                <label>Adjustment Date *</label>
                <input
                  type="date"
                  name="adjustment_date"
                  value={form.adjustment_date}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="payment-form-group">
                <label>Reason *</label>
                <textarea
                  name="reason"
                  rows="3"
                  value={form.reason}
                  onChange={handleChange}
                  placeholder="Enter reason for this adjustment..."
                  required
                />
              </div>

              <div className="payment-form-notice">
                {adjustmentType === "ADD"
                  ? "This amount will increase the shop's unpaid balance."
                  : "This amount will decrease the shop's unpaid balance."}
              </div>

              {error && (
                <div className="shop-error-message">
                  {error}
                </div>
              )}

              <div className="payment-modal-actions">

                <button
                  type="button"
                  className="payment-cancel-button"
                  onClick={closeForm}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="payment-submit-button"
                  disabled={saving}
                >
                  {saving
                    ? "Saving..."
                    : adjustmentType === "ADD"
                      ? "Add Balance"
                      : "Subtract Balance"}
                </button>

              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}