
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
} from "lucide-react";

import db from "../database/localDb";

import "./ShopDashboard.css";

const emptyForm = {
  amount: "",
  reason: "",
  adjustment_date: new Date().toLocaleDateString("en-CA"),
};

function createId() {
  return crypto.randomUUID();
}

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

function sortAdjustments(items) {
  return [...items].sort((a, b) => {
    const dateDifference =
      new Date(b.adjustment_date) -
      new Date(a.adjustment_date);

    if (dateDifference !== 0) return dateDifference;

    return String(b.created_at || "").localeCompare(
      String(a.created_at || "")
    );
  });
}

// GET CURRENT UNPAID BALANCE
function calculateUnpaid(shop, adjustments = []) {
  if (shop?.unpaid_balance !== undefined &&
      shop?.unpaid_balance !== null) {
    return Number(shop.unpaid_balance);
  }

  const added = adjustments
    .filter((item) => item.adjustment_type === "ADD")
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);

  const subtracted = adjustments
    .filter((item) => item.adjustment_type === "SUBTRACT")
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);

  return Number(shop?.opening_balance || 0) + added - subtracted;
}

export default function ShopDashboard() {
  const navigate = useNavigate();
  const { shopId } = useParams();

  const [shop, setShop] = useState(null);
  const [adjustments, setAdjustments] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [adjustmentType, setAdjustmentType] = useState("ADD");
  const [form, setForm] = useState(emptyForm);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // FIND LOCAL SHOP
  const findLocalShop = useCallback(async () => {
    let localShop = await db.shops.get(shopId);

    if (!localShop && !Number.isNaN(Number(shopId))) {
      localShop = await db.shops.get(Number(shopId));
    }

    if (!localShop) {
      const allShops = await db.shops.toArray();

      localShop = allShops.find(
        (item) => String(item.server_id) === String(shopId)
      );
    }

    return localShop || null;
  }, [shopId]);

  // LOAD DASHBOARD
  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const localShop = await findLocalShop();

      if (!localShop) {
        setShop(null);
        setAdjustments([]);
        throw new Error("Shop not found in the local database.");
      }

      const localAdjustments = await db.adjustments
        .toArray();

      const shopAdjustments = localAdjustments.filter(
        (item) => String(item.shop_id) === String(localShop.id)
      );

      setShop(localShop);
      setAdjustments(sortAdjustments(shopAdjustments));
    } catch (err) {
      console.error("Shop dashboard loading error:", err);
      setError(err.message || "Unable to load shop information.");
    } finally {
      setLoading(false);
    }
  }, [findLocalShop]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  // OPEN ADJUSTMENT FORM
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
    setError("");
  }

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  // SAVE ADJUSTMENT AND UPDATE SHOP UNPAID
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

    if (!form.adjustment_date) {
      setError("Please select an adjustment date.");
      return;
    }

    if (!shop?.id) {
      setError("Shop information is unavailable.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setNotice("");

      const operationId = createId();
      const now = new Date().toISOString();

      let newUnpaidBalance = 0;

      // BOTH OPERATIONS SAVE TOGETHER.
      // If one fails, the transaction rolls back.
      await db.transaction(
        "rw",
        db.shops,
        db.adjustments,
        async () => {
          const latestShop = await db.shops.get(shop.id);

          if (!latestShop) {
            throw new Error("Shop not found.");
          }

          const allAdjustments = await db.adjustments.toArray();

          const shopAdjustments = allAdjustments.filter(
            (item) =>
              String(item.shop_id) === String(latestShop.id)
          );

          const currentUnpaid = calculateUnpaid(
            latestShop,
            shopAdjustments
          );

          if (
            adjustmentType === "SUBTRACT" &&
            amount > currentUnpaid
          ) {
            throw new Error(
              "Subtract amount cannot be greater than current Unpaid balance."
            );
          }

          newUnpaidBalance =
            adjustmentType === "ADD"
              ? currentUnpaid + amount
              : currentUnpaid - amount;

          const adjustment = {
            id: operationId,
            operation_id: operationId,
            shop_id: latestShop.id,

            adjustment_type: adjustmentType,
            amount,
            reason: form.reason.trim(),
            adjustment_date: form.adjustment_date,

            synced: true,
            created_at: now,
            updated_at: now,
          };

          // Save adjustment history
          await db.adjustments.add(adjustment);

          // Update actual shop unpaid balance
          await db.shops.update(latestShop.id, {
            unpaid_balance: newUnpaidBalance,
            updated_at: now,
            synced: true,
          });
        }
      );

      setShowForm(false);
      setForm(emptyForm);

      setNotice(
        adjustmentType === "ADD"
          ? "Balance added and Unpaid updated successfully."
          : "Balance subtracted and Unpaid updated successfully."
      );

      // Reload latest shop and adjustment history
      await loadDashboard();
    } catch (err) {
      console.error("Adjustment saving error:", err);

      setError(
        err.message || "Unable to save balance adjustment."
      );
    } finally {
      setSaving(false);
    }
  }

  // BALANCE CALCULATIONS
  const totalAdded = adjustments
    .filter((item) => item.adjustment_type === "ADD")
    .reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0
    );

  const totalSubtracted = adjustments
    .filter((item) => item.adjustment_type === "SUBTRACT")
    .reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0
    );

  const totalUnpaid = calculateUnpaid(shop, adjustments);

  const whatsappLink = getWhatsAppLink(
    shop?.whatsapp_number || shop?.phone
  );

  // LOADING
  if (loading && !shop) {
    return (
      <div className="shop-loading">
        <RefreshCw className="spin" size={28} />
        <p>Loading shop information...</p>
      </div>
    );
  }

  // SHOP NOT AVAILABLE
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

  // MAIN UI
  return (
    <div className="shop-dashboard">

      <button
        className="shop-back-button"
        onClick={() => navigate("/shops")}
      >
        <ArrowLeft size={17} />
        Back to Shops
      </button>

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

        <div className="shop-stat-card balance">
          <div className="shop-stat-icon">
            <History size={21} />
          </div>

          <span>Total Unpaid</span>
          <h2>{formatMoney(totalUnpaid)}</h2>
          <small>Current remaining balance</small>
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

      </section>

      {/* ADJUSTMENT HISTORY */}
      <section className="shop-history-section">

        <div className="shop-history-header">
          <div>
            <h2>Balance Adjustment History</h2>
            <p>
              Complete record of additions and subtractions.
            </p>
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
                  key={item.operation_id || item.id}
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
                    <strong
                      className={
                        isAdd
                          ? "amount-add"
                          : "amount-subtract"
                      }
                    >
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
