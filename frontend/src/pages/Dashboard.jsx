
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  Store,
  MapPin,
  Wallet,
  TrendingUp,
  Truck,
  RefreshCw,
  CreditCard,
} from "lucide-react";

import { apiRequest } from "../services/api";
import StatCard from "../components/StatCard";
import "./Dashboard.css";

const formatRupees = (amount) =>
  `Rs. ${Number(amount || 0).toLocaleString("en-PK", {
    maximumFractionDigits: 2,
  })}`;

const formatDate = (date) => {
  if (!date) return "-";

  return new Date(date).toLocaleDateString("en-PK", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

export default function Dashboard() {
  const navigate = useNavigate();

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

        <button
          className="primary-button"
          onClick={() => navigate("/shops")}
        >
          + New Delivery
        </button>
      </div>

      {/* Statistics */}
      <div className="stats-grid">
        <StatCard
          title="Total Sales"
          value={formatRupees(stats.total_sales)}
          description="Total delivered value"
          icon={TrendingUp}
          color="pink"
        />

        <StatCard
          title="Total Received"
          value={formatRupees(stats.total_received)}
          description="Payments collected"
          icon={Wallet}
          color="green"
        />

        <StatCard
          title="Total Unpaid"
          value={formatRupees(stats.total_unpaid)}
          description="Remaining payments"
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

        <StatCard
          title="Today's Deliveries"
          value={stats.today_deliveries || 0}
          description={`Today's sales: ${formatRupees(stats.today_sales)}`}
          icon={Truck}
          color="pink"
        />
      </div>

      {/* Recent Records */}
      <div className="dashboard-bottom">
        <div className="content-card">
          <h3>Recent Deliveries</h3>
          <p className="muted">Latest deliveries to your shops</p>

          {dashboard.recent_deliveries?.length > 0 ? (
            <div className="recent-records">
              {dashboard.recent_deliveries.map((delivery) => (
                <div className="recent-record" key={delivery.id}>
                  <div className="record-icon delivery-icon">
                    <Truck size={19} />
                  </div>

                  <div className="record-info">
                    <strong>{delivery.shop_name}</strong>
                    <span>
                      {delivery.invoice_number} · {formatDate(delivery.delivery_date)}
                    </span>
                  </div>

                  <strong className="record-amount">
                    {formatRupees(delivery.total_amount)}
                  </strong>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <Truck size={35} />
              <p>No deliveries recorded yet.</p>
            </div>
          )}
        </div>

        <div className="content-card">
          <h3>Business Overview</h3>
          <p className="muted">Your current financial position</p>

          <div className="overview-item">
            <span>Total Sales</span>
            <strong>{formatRupees(stats.total_sales)}</strong>
          </div>

          <div className="overview-item">
            <span>Received</span>
            <strong className="success-text">
              {formatRupees(stats.total_received)}
            </strong>
          </div>

          <div className="overview-item">
            <span>Unpaid</span>
            <strong className="warning-text">
              {formatRupees(stats.total_unpaid)}
            </strong>
          </div>

          <div className="overview-item">
            <span>Today's Sales</span>
            <strong>{formatRupees(stats.today_sales)}</strong>
          </div>
        </div>
      </div>

      {/* Recent Payments */}
      <div className="content-card recent-payments-card">
        <h3>Recent Payments</h3>
        <p className="muted">Latest payments received from shops</p>

        {dashboard.recent_payments?.length > 0 ? (
          <div className="recent-records">
            {dashboard.recent_payments.map((payment) => (
              <div className="recent-record" key={payment.id}>
                <div className="record-icon payment-icon">
                  <CreditCard size={19} />
                </div>

                <div className="record-info">
                  <strong>{payment.shop_name}</strong>
                  <span>
                    {payment.payment_method || "Payment"} · {formatDate(payment.payment_date)}
                  </span>
                </div>

                <strong className="success-text record-amount">
                  + {formatRupees(payment.amount)}
                </strong>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <Wallet size={35} />
            <p>No payments recorded yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
