import {
  Store,
  MapPin,
  Wallet,
  TrendingUp,
  Truck
} from "lucide-react";

import StatCard from "../components/StatCard";

export default function Dashboard() {
  return (
    <div className="dashboard">

      <div className="page-heading">
        <div>
          <h1>Dashboard</h1>
          <p>Welcome to Miss Noori Business Management System.</p>
        </div>

        <button className="primary-button">
          + New Delivery
        </button>
      </div>

      <div className="stats-grid">

        <StatCard
          title="Total Sales"
          value="Rs. 125,000"
          description="Total delivered value"
          icon={TrendingUp}
          color="pink"
        />

        <StatCard
          title="Total Received"
          value="Rs. 85,000"
          description="Payments collected"
          icon={Wallet}
          color="green"
        />

        <StatCard
          title="Outstanding"
          value="Rs. 40,000"
          description="Remaining payments"
          icon={Wallet}
          color="orange"
        />

        <StatCard
          title="Total Shops"
          value="48"
          description="Registered shops"
          icon={Store}
          color="blue"
        />

        <StatCard
          title="Locations"
          value="12"
          description="Villages and towns"
          icon={MapPin}
          color="purple"
        />

        <StatCard
          title="Deliveries"
          value="16"
          description="Today's deliveries"
          icon={Truck}
          color="pink"
        />

      </div>

      <div className="dashboard-bottom">

        <div className="content-card">
          <h3>Recent Deliveries</h3>
          <p className="muted">Your latest shop deliveries will appear here.</p>

          <div className="empty-state">
            <Truck size={35} />
            <p>No deliveries recorded yet.</p>
          </div>
        </div>

        <div className="content-card">
          <h3>Business Overview</h3>
          <p className="muted">Your current financial position</p>

          <div className="overview-item">
            <span>Total Sales</span>
            <strong>Rs. 125,000</strong>
          </div>

          <div className="overview-item">
            <span>Received</span>
            <strong className="success-text">Rs. 85,000</strong>
          </div>

          <div className="overview-item">
            <span>Remaining</span>
            <strong className="warning-text">Rs. 40,000</strong>
          </div>
        </div>

      </div>
    </div>
  );
}