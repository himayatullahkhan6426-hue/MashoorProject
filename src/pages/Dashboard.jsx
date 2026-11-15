
import { useEffect, useState } from "react";
import {
  MapPin,
  Store,
  Wallet,
  TrendingUp,
  Banknote,
  RefreshCw,
  LayoutDashboard,
  Clock,
  CalendarDays,
  PackagePlus,
} from "lucide-react";

import db from "../database/localDb";
import { getLocalShops } from "../services/localShopStorage";

import "./Dashboard.css";

function formatRupees(amount) {
  return `Rs. ${Number(amount || 0).toLocaleString("en-PK")}`;
}

function getTodayDate() {
  const now = new Date();

  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
}

function getRecordDate(value) {
  if (!value) return "";

  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  return String(value).slice(0, 10);
}

// Get actual saved transaction timestamp.
function getTransactionTimestamp(item) {
  const possibleFields = [
    item.created_at,
    item.createdAt,
    item.timestamp,
    item.adjustment_datetime,
    item.date_created,
    item.updated_at,
  ];

  for (const value of possibleFields) {
    if (!value) continue;

    const date = new Date(value);

    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }

  const adjustmentDate = item.adjustment_date;

  if (
    adjustmentDate instanceof Date &&
    !Number.isNaN(adjustmentDate.getTime())
  ) {
    return adjustmentDate;
  }

  if (
    typeof adjustmentDate === "string" &&
    /\d[T ]\d{2}:\d{2}/.test(adjustmentDate)
  ) {
    const date = new Date(adjustmentDate);

    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }

  return null;
}

function formatTransactionTime(item) {
  const date = getTransactionTimestamp(item);

  if (!date) return "Time not recorded";

  return date.toLocaleTimeString("en-PK", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

function Dashboard() {
  const [stats, setStats] = useState({
    totalAreas: 0,
    totalShops: 0,
    totalUnpaid: 0,
    todaySale: 0,
    todayReceived: 0,
  });

  const [todayAdded, setTodayAdded] = useState([]);
  const [todayPayments, setTodayPayments] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadDashboard() {
    try {
      setLoading(true);
      setError("");

      const today = getTodayDate();

      const [areas, shops, adjustments] = await Promise.all([
        db.areas.toArray(),
        getLocalShops(),
        db.adjustments.toArray(),
      ]);

      const activeAreas = areas.filter(
        (area) => area.is_active !== false
      );

      const totalUnpaid = shops.reduce(
        (total, shop) =>
          total + Number(shop.unpaid_balance || 0),
        0
      );

      const todayAdjustments = adjustments.filter(
        (item) =>
          getRecordDate(item.adjustment_date) === today
      );

      const addedRecords = todayAdjustments
        .filter((item) => item.adjustment_type === "ADD")
        .sort(
          (a, b) =>
            (getTransactionTimestamp(b)?.getTime() || 0) -
            (getTransactionTimestamp(a)?.getTime() || 0)
        );

      const receivedRecords = todayAdjustments
        .filter((item) => item.adjustment_type === "SUBTRACT")
        .sort(
          (a, b) =>
            (getTransactionTimestamp(b)?.getTime() || 0) -
            (getTransactionTimestamp(a)?.getTime() || 0)
        );

      const todaySale = addedRecords.reduce(
        (total, item) => total + Number(item.amount || 0),
        0
      );

      const todayReceived = receivedRecords.reduce(
        (total, item) => total + Number(item.amount || 0),
        0
      );

      function addShopName(item) {
        const shop = shops.find(
          (shopItem) =>
            String(shopItem.id) === String(item.shop_id)
        );

        return {
          ...item,
          displayShopName:
            shop?.shop_name ||
            shop?.name ||
            "Unknown Shop",
        };
      }

      setStats({
        totalAreas: activeAreas.length,
        totalShops: shops.length,
        totalUnpaid,
        todaySale,
        todayReceived,
      });

      setTodayAdded(addedRecords.map(addShopName));
      setTodayPayments(receivedRecords.map(addShopName));
    } catch (err) {
      console.error("Dashboard loading error:", err);
      setError(err.message || "Unable to load dashboard.");
    } finally {
      setLoading(false);
    }
  }

  // Initial dashboard load.
  useEffect(() => {
    loadDashboard();
  }, []);

  // Automatically refresh at midnight.
  useEffect(() => {
    let timer;

    function scheduleMidnightRefresh() {
      const now = new Date();
      const midnight = new Date(now);

      midnight.setHours(24, 0, 0, 0);

      timer = setTimeout(() => {
        loadDashboard();
        scheduleMidnightRefresh();
      }, midnight.getTime() - now.getTime());
    }

    scheduleMidnightRefresh();

    return () => clearTimeout(timer);
  }, []);

  // Render Added or Received history.
  function renderHistory(records, type) {
    const isAdded = type === "ADD";

    return (
      <div
        className={`payment-history-section ${
          isAdded
            ? "added-history-section"
            : "received-history-section"
        }`}
      >
        <div className="today-payment-header">
          <div>
            <div className="today-payment-title">
              {isAdded ? (
                <PackagePlus size={21} />
              ) : (
                <Banknote size={21} />
              )}

              <h2>{isAdded ? "Added" : "Received"}</h2>
            </div>

            <p>
              {isAdded
                ? "Shops and credit goods added today."
                : "Payments received from shops today."}
            </p>
          </div>

          <span className="today-payment-date">
            {new Date().toLocaleDateString("en-PK", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
          </span>
        </div>

        {loading ? (
          <div className="payment-history-empty">
            Loading history...
          </div>
        ) : records.length === 0 ? (
          <div className="payment-history-empty">
            {isAdded ? (
              <PackagePlus size={30} />
            ) : (
              <Banknote size={30} />
            )}

            <h3>
              {isAdded
                ? "No Added Records Today"
                : "No Received Payments Today"}
            </h3>

            <p>
              {isAdded
                ? "Today's added records will appear here."
                : "Today's received payments will appear here."}
            </p>
          </div>
        ) : (
          <div className="payment-history-list">
            {records.map((record, index) => (
              <div
                className={`payment-history-item ${
                  isAdded
                    ? "added-history-item"
                    : "received-history-item"
                }`}
                key={record.id || index}
              >
                <div className="payment-history-icon">
                  {isAdded ? (
                    <PackagePlus size={20} />
                  ) : (
                    <Banknote size={20} />
                  )}
                </div>

                <div className="payment-history-details">
                  <h3>{record.displayShopName}</h3>

                  <span>
                    <Clock size={13} />
                    {formatTransactionTime(record)}
                  </span>
                </div>

                <div className="payment-history-amount">
                  <span>
                    {isAdded ? "Added" : "Received"}
                  </span>

                  <strong>
                    + {formatRupees(record.amount)}
                  </strong>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      {/* DASHBOARD HEADER */}
      <div className="dashboard-header">
        <div>
          <div className="dashboard-title">
            <LayoutDashboard size={25} />
            <h1>Dashboard</h1>
          </div>

          <p>Overview of your cosmetics business.</p>
        </div>

        <button
          type="button"
          className="dashboard-refresh-btn"
          onClick={loadDashboard}
          disabled={loading}
        >
          <RefreshCw
            size={17}
            className={loading ? "dashboard-spin" : ""}
          />
          Refresh
        </button>
      </div>

      {error && (
        <div className="dashboard-error">
          {error}
        </div>
      )}

      {/* DASHBOARD STATISTICS */}
      <div className="dashboard-stats">
        <div className="dashboard-stat-card">
          <div className="dashboard-stat-icon">
            <MapPin size={23} />
          </div>

          <div className="dashboard-stat-info">
            <p>Total Areas</p>
            <h2>
              {loading ? "..." : stats.totalAreas}
            </h2>
          </div>
        </div>

        <div className="dashboard-stat-card">
          <div className="dashboard-stat-icon">
            <Store size={23} />
          </div>

          <div className="dashboard-stat-info">
            <p>Total Shops</p>
            <h2>
              {loading ? "..." : stats.totalShops}
            </h2>
          </div>
        </div>

        <div className="dashboard-stat-card">
          <div className="dashboard-stat-icon">
            <Wallet size={23} />
          </div>

          <div className="dashboard-stat-info">
            <p>Total Unpaid</p>
            <h2>
              {loading
                ? "..."
                : formatRupees(stats.totalUnpaid)}
            </h2>
          </div>
        </div>

        <div className="dashboard-stat-card">
          <div className="dashboard-stat-icon">
            <TrendingUp size={23} />
          </div>

          <div className="dashboard-stat-info">
            <p>Today's Sale</p>
            <h2>
              {loading
                ? "..."
                : formatRupees(stats.todaySale)}
            </h2>
          </div>
        </div>

        <div className="dashboard-stat-card">
          <div className="dashboard-stat-icon">
            <Banknote size={23} />
          </div>

          <div className="dashboard-stat-info">
            <p>Today's Rupees Received</p>
            <h2>
              {loading
                ? "..."
                : formatRupees(stats.todayReceived)}
            </h2>
          </div>
        </div>
      </div>

      {/* ADDED HISTORY */}
      {renderHistory(todayAdded, "ADD")}

      {/* RECEIVED HISTORY */}
      {renderHistory(todayPayments, "SUBTRACT")}
    </div>
  );
}

export default Dashboard;
