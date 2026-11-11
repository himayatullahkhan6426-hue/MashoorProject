
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus, Search, MapPin, Pencil, X, RefreshCw,
  Store, ArrowRight, AlertTriangle, Wifi, WifiOff,
  LockKeyhole, ShieldAlert
} from "lucide-react";

import { apiRequest } from "../services/api";
import {
  getLocalAreas,
  saveLocalAreas,
  createLocalArea,
  updateLocalArea,
  deactivateLocalArea,
  getPendingSyncCount,
} from "../services/offlineStorage";
import { syncPendingAdjustments } from "../services/offlineSync";

import "./Areas.css";

const emptyForm = {
  name: "",
  area_type: "VILLAGE",
  district: "",
  description: "",
};

export default function Areas() {
  const navigate = useNavigate();

  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [deactivateArea, setDeactivateArea] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [online, setOnline] = useState(navigator.onLine);
  const [saving, setSaving] = useState(false);

  const [confirmText, setConfirmText] = useState("");
  const [password, setPassword] = useState("");
  const [deactivateError, setDeactivateError] = useState("");

  const requiredText = deactivateArea
    ? `Delete Area ${deactivateArea.name} and it's related all shops`
    : "";

  async function refreshPendingCount() {
    setPendingCount(await getPendingSyncCount());
  }

  async function loadAreas() {
    try {
      setLoading(true);
      setError("");

      if (navigator.onLine) {
        try {
          const response = await apiRequest("/areas");
          const serverAreas = response.areas || [];

          await saveLocalAreas(serverAreas);

          setAreas(serverAreas.filter((area) => area.is_active));
          await refreshPendingCount();
          return;
        } catch (err) {
          if (navigator.onLine) throw err;
        }
      }

      const localAreas = await getLocalAreas();
      setAreas(localAreas.filter((area) => area.is_active));
      await refreshPendingCount();
    } catch (err) {
      setError(err.message || "Unable to load areas.");

      try {
        const localAreas = await getLocalAreas();
        if (localAreas.length > 0) {
          setAreas(localAreas.filter((area) => area.is_active));
        }
      } catch (localError) {
        console.error("Local areas error:", localError);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAreas();

    function handleOnline() {
      setOnline(true);
      syncPendingAdjustments()
        .then(loadAreas)
        .catch((err) => console.error("Area sync error:", err));
    }

    function handleOffline() {
      setOnline(false);
      loadAreas();
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  function handleChange(e) {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  }

  function openAddForm() {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
    setShowForm(true);
  }

  function openEditForm(area, e) {
    e.stopPropagation();

    setEditingId(area.id);
    setForm({
      name: area.name || "",
      area_type: area.area_type || "VILLAGE",
      district: area.district || "",
      description: area.description || "",
    });

    setError("");
    setShowForm(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setNotice("");

    if (!form.name.trim()) {
      setError("Area name is required.");
      return;
    }

    try {
      setSaving(true);

      if (editingId) {
        await updateLocalArea(editingId, {
          ...form,
          name: form.name.trim(),
          district: form.district.trim(),
          description: form.description.trim(),
        });

        setNotice("Area updated successfully.");
      } else {
        await createLocalArea({
          ...form,
          name: form.name.trim(),
          district: form.district.trim(),
          description: form.description.trim(),
        });

        setNotice("Area added successfully.");
      }

      setShowForm(false);
      setForm(emptyForm);
      setEditingId(null);

      await refreshPendingCount();

      if (navigator.onLine) {
        await syncPendingAdjustments();
      }

      await loadAreas();
    } catch (err) {
      setError(err.message || "Unable to save area.");
    } finally {
      setSaving(false);
    }
  }

  function openDeactivateModal(area) {
    setDeactivateArea(area);
    setConfirmText("");
    setPassword("");
    setDeactivateError("");
    setError("");
  }

  function closeDeactivateModal() {
    if (saving) return;

    setDeactivateArea(null);
    setConfirmText("");
    setPassword("");
    setDeactivateError("");
  }

  async function confirmDeactivation() {
    if (!deactivateArea) return;

    if (!password.trim()) {
      setDeactivateError("Please enter your account password.");
      return;
    }

    if (confirmText !== requiredText) {
      setDeactivateError("Confirmation text does not match.");
      return;
    }

    if (navigator.onLine) {
      setDeactivateError(
        "Password verification endpoint is not yet connected. We need to add backend password verification before allowing this action."
      );
      return;
    }

    setDeactivateError(
      "Offline deactivation with password verification is not enabled yet."
    );
  }

  const filteredAreas = areas.filter((area) =>
    `${area.name} ${area.district || ""} ${area.area_type}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const totalVillages = areas.filter(
    (area) => area.area_type === "VILLAGE"
  ).length;

  const totalTowns = areas.filter(
    (area) => area.area_type === "TOWN"
  ).length;

  return (
    <div className="areas-page">
      <div className="areas-header">
        <div>
          <h1>Areas Management</h1>
          <p>Manage villages, towns and their shops.</p>
        </div>

        <button className="primary-btn" onClick={openAddForm}>
          <Plus size={18} />
          Add Area
        </button>
      </div>

      <div className="areas-sync-status">
        {online ? <Wifi size={17} /> : <WifiOff size={17} />}

        <span>
          {online ? "Online" : "Offline — Local Database"}
        </span>

        {pendingCount > 0 && (
          <span className="pending-sync">
            {pendingCount} pending changes
          </span>
        )}

        <button type="button" onClick={loadAreas} title="Refresh areas">
          <RefreshCw size={16} />
        </button>
      </div>

      <div className="areas-stats">
        <div className="area-stat-card">
          <div className="area-stat-icon"><MapPin size={22} /></div>
          <div><h3>{areas.length}</h3><p>Total Areas</p></div>
        </div>

        <div className="area-stat-card">
          <div className="area-stat-icon"><Store size={22} /></div>
          <div><h3>{totalVillages}</h3><p>Villages</p></div>
        </div>

        <div className="area-stat-card">
          <div className="area-stat-icon"><MapPin size={22} /></div>
          <div><h3>{totalTowns}</h3><p>Towns</p></div>
        </div>
      </div>

      {notice && (
        <div className="area-notice">
          {notice}
          <button onClick={() => setNotice("")}><X size={16} /></button>
        </div>
      )}

      {error && (
        <div className="area-error">
          <AlertTriangle size={17} />
          {error}
          <button onClick={() => setError("")}><X size={16} /></button>
        </div>
      )}

      <div className="areas-toolbar">
        <div className="areas-search">
          <Search size={18} />
          <input
            placeholder="Search areas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <span>{filteredAreas.length} areas found</span>
      </div>

      {loading ? (
        <div className="areas-loading">
          <RefreshCw size={22} className="spin" />
          Loading areas...
        </div>
      ) : filteredAreas.length === 0 ? (
        <div className="areas-empty">
          <MapPin size={35} />
          <h3>No areas found</h3>
          <p>Add your first area to get started.</p>
        </div>
      ) : (
        <div className="areas-grid">
          {filteredAreas.map((area) => (
            <div
              className="area-card"
              key={area.id}
              onClick={() => navigate(`/areas/${area.id}/shops`)}
            >
              <div className="area-card-top">
                <div className="area-card-icon"><MapPin size={22} /></div>

                <div className="area-card-actions">
                  <button
                    type="button"
                    title="Edit area"
                    onClick={(e) => openEditForm(area, e)}
                  >
                    <Pencil size={17} />
                  </button>

                  <button
                    type="button"
                    title="Deactivate area"
                    onClick={(e) => {
                      e.stopPropagation();
                      openDeactivateModal(area);
                    }}
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              <h3>{area.name}</h3>
              <p>{area.district || "No district specified"}</p>

              <div className="area-card-bottom">
                <span className="area-type">{area.area_type}</span>
                <span className="area-view">
                  View Shops <ArrowRight size={16} />
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="area-modal-overlay">
          <div className="area-modal">
            <div className="area-modal-header">
              <div>
                <h2>{editingId ? "Edit Area" : "Add New Area"}</h2>
                <p>Enter area information below.</p>
              </div>
              <button type="button" onClick={() => setShowForm(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <label>Area Name *</label>
              <input name="name" value={form.name} onChange={handleChange}
                placeholder="Enter area name" required />

              <label>Area Type *</label>
              <select name="area_type" value={form.area_type}
                onChange={handleChange} required>
                <option value="VILLAGE">Village</option>
                <option value="TOWN">Town</option>
              </select>

              <label>District</label>
              <input name="district" value={form.district}
                onChange={handleChange} placeholder="Enter district" />

              <label>Description</label>
              <textarea name="description" value={form.description}
                onChange={handleChange} placeholder="Optional description"
                rows={3} />

              {error && <p className="form-error">{error}</p>}

              <div className="area-modal-buttons">
                <button type="button" className="cancel-btn"
                  onClick={() => setShowForm(false)}>
                  Cancel
                </button>

                <button type="submit" className="primary-btn" disabled={saving}>
                  {saving ? "Saving..." : editingId ? "Update Area" : "Save Area"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deactivateArea && (
        <div className="area-modal-overlay">
          <div className="area-modal deactivate-modal">
            <div className="area-modal-header">
              <div>
                <h2>Security Confirmation</h2>
                <p>Confirm this action before proceeding.</p>
              </div>
              <button type="button" onClick={closeDeactivateModal}>
                <X size={20} />
              </button>
            </div>

            <div className="deactivate-warning">
              <ShieldAlert size={24} />
              <p>
                You are about to deactivate <strong>{deactivateArea.name}</strong>.
                Its shops and financial history will not be permanently deleted.
              </p>
            </div>

            <label>
              <LockKeyhole size={15} /> Account Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your account password"
              autoComplete="current-password"
            />

            <label>Type this confirmation text exactly:</label>
            <div className="confirmation-text">{requiredText}</div>

            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Type confirmation text here"
              autoComplete="off"
            />

            {deactivateError && (
              <p className="form-error">{deactivateError}</p>
            )}

            <div className="area-modal-buttons">
              <button type="button" className="cancel-btn"
                onClick={closeDeactivateModal}>
                Cancel
              </button>

              <button
                type="button"
                className="primary-btn"
                disabled={
                  saving ||
                  !password.trim() ||
                  confirmText !== requiredText
                }
                onClick={confirmDeactivation}
              >
                {saving ? "Processing..." : "Confirm Deactivation"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
