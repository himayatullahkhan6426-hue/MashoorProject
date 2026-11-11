
import { useEffect, useState } from "react";

import {
  Store,
  MapPin,
  Wallet,
  TrendingUp,
  RefreshCw,
} from "lucide-react";

import { apiRequest } from "../services/api";
import StatCard from "../components/StatCard";
import "./Dashboard.css";

const formatRupees = (amount) =>
  `Rs. ${Number(amount || 0).toLocaleString("en-PK", {
    maximumFractionDigits: 2,
  })}`;

export default function Dashboard() {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      setLoading(true);
      setError("");

      const data = await apiRequest("/dashboard");

      setDashboard(data);
    } catch (err) {
      setError(err.message || "Unable to load dashboard.");
    } finally {
      setLoading(false);
    }
  }

  const stats = dashboard?.stats || {};

  if (loading) {
    return (
      <div className="dashboard-loading">
        <RefreshCw className="loading-icon" size={28} />
        <p>Loading dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard">
        <div className="page-heading">
          <div>
            <h1>Dashboard</h1>
            <p>Welcome to Miss Noori Business Management System.</p>
          </div>
        </div>

        <div className="dashboard-error">
          <p>{error}</p>
          <button className="primary-button" onClick={loadDashboard}>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="page-heading">
        <div>
          <h1>Dashboard</h1>
          <p>Welcome to Miss Noori Business Management System.</p>
        </div>
      </div>

      {/* Statistics */}
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

      {/* Business Overview */}
      <div className="dashboard-bottom">
        <div className="content-card">
          <h3>Business Overview</h3>
          <p className="muted">Your current financial position</p>

          <div className="overview-item">
            <span>Total Unpaid</span>
            <strong className="warning-text">
              {formatRupees(stats.total_unpaid)}
            </strong>
          </div>

          <div className="overview-item">
            <span>Total Shops</span>
            <strong>{stats.total_shops || 0}</strong>
          </div>

          <div className="overview-item">
            <span>Total Areas</span>
            <strong>{stats.total_areas || 0}</strong>
          </div>
        </div>
      </div>
    </div>
  );
}
