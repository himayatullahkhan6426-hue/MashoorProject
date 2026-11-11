
import { useEffect, useState } from "react";

import {
  Store,
  MapPin,
  Wallet,
  RefreshCw,
} from "lucide-react";

import db from "../database/localDb";

import StatCard from "../components/StatCard";
import "./Dashboard.css";

const formatRupees = (amount) =>
  `Rs. ${Number(amount || 0).toLocaleString("en-PK", {
    maximumFractionDigits: 2,
  })}`;

// ==========================================
// LOCAL DASHBOARD CALCULATION
// ==========================================

async function getLocalDashboard() {
  const [areas, shops, adjustments] = await Promise.all([
    db.areas.toArray(),
    db.shops.toArray(),
    db.adjustments.toArray(),
  ]);

  const activeAreas = areas.filter(
    (area) => area.is_active !== false
  );

  const activeShops = shops.filter(
    (shop) => shop.is_active !== false
  );

  const activeShopIds = new Set(
    activeShops.map((shop) => String(shop.id))
  );

  // Calculate opening balances
  let totalUnpaid = activeShops.reduce(
    (total, shop) =>
      total + Number(shop.opening_balance || 0),
    0
  );

  // Apply balance adjustments
  for (const adjustment of adjustments) {
    if (!activeShopIds.has(String(adjustment.shop_id))) {
      continue;
    }

    const amount = Number(adjustment.amount || 0);

    const type = String(
      adjustment.adjustment_type || ""
    ).toUpperCase();

    if (type === "ADD") {
      totalUnpaid += amount;
    } else if (type === "SUBTRACT") {
      totalUnpaid -= amount;
    }
  }

  return {
    stats: {
      total_unpaid: totalUnpaid,
      total_shops: activeShops.length,
      total_areas: activeAreas.length,
    },
  };
}

// ==========================================
// DASHBOARD
// ==========================================

export default function Dashboard() {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // ========================================
  // LOAD LOCAL DASHBOARD
  // ========================================

  async function loadDashboard() {
    try {
      setLoading(true);
      setError("");

      const data = await getLocalDashboard();

      setDashboard(data);
    } catch (err) {
      console.error("Local dashboard error:", err);

      setError(
        "Unable to load dashboard from local database."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  const stats = dashboard?.stats || {};

  // ========================================
  // LOADING
  // ========================================

  if (loading) {
    return (
      <div className="dashboard-loading">
        <RefreshCw className="loading-icon" size={28} />
        <p>Loading dashboard...</p>
      </div>
    );
  }

  // ========================================
  // ERROR
  // ========================================

  if (error) {
    return (
      <div className="dashboard">
        <div className="page-heading">
          <div>
            <h1>Dashboard</h1>

            <p>
              Welcome to Miss Noori Business Management System.
            </p>
          </div>
        </div>

        <div className="dashboard-error">
          <p>{error}</p>

          <button
            className="primary-button"
            onClick={loadDashboard}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // ========================================
  // DASHBOARD UI
  // ========================================

  return (
    <div className="dashboard">
      <div className="page-heading">
        <div>
          <h1>Dashboard</h1>

          <p>
            Welcome to Miss Noori Business Management System.
          </p>

          <p className="muted">
            Local Mode — Showing data saved on this device.
          </p>
        </div>
      </div>

      {/* STATISTICS */}

      <div className="stats-grid">
        <StatCard
          title="Total Unpaid"
          value={formatRupees(stats.total_unpaid)}
          description="Total opening balance after adjustments"
          icon={Wallet}
          color="orange"
        />

        <StatCard
          title="Total Shops"
          value={stats.total_shops || 0}
          description="Active registered shops"
          icon={Store}
          color="blue"
        />

        <StatCard
          title="Total Areas"
          value={stats.total_areas || 0}
          description="Active locations"
          icon={MapPin}
          color="purple"
        />
      </div>

      {/* BUSINESS OVERVIEW */}

      <div className="dashboard-bottom">
        <div className="content-card">
          <h3>Business Overview</h3>

          <p className="muted">
            Your current financial position
          </p>

          <div className="overview-item">
            <span>Total Unpaid</span>

            <strong className="warning-text">
              {formatRupees(stats.total_unpaid)}
            </strong>
          </div>

          <div className="overview-item">
            <span>Total Shops</span>

            <strong>
              {stats.total_shops || 0}
            </strong>
          </div>

          <div className="overview-item">
            <span>Total Areas</span>

            <strong>
              {stats.total_areas || 0}
            </strong>
          </div>
        </div>
      </div>
    </div>
  );
}
