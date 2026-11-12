
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  Search,
  MapPin,
  Pencil,
  X,
  RefreshCw,
  Store,
  ArrowRight,
  AlertTriangle,
  LockKeyhole,
  ShieldAlert,
  Trash2,
} from "lucide-react";

import db from "../database/localDb";
import { verifyDevicePassword } from "../services/localAuth";

import "./Areas.css";

const emptyForm = {
  name: "",
  area_type: "VILLAGE",
  district: "",
  description: "",
};

function normalizeAreaName(name) {
  return String(name || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

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
  const [deleteArea, setDeleteArea] = useState(null);
  const [saving, setSaving] = useState(false);

  const [confirmText, setConfirmText] = useState("");
  const [password, setPassword] = useState("");
  const [deleteError, setDeleteError] = useState("");

  const requiredText = deleteArea ? deleteArea.name : "";

  async function loadAreas() {
    try {
      setLoading(true);
      setError("");

      const localAreas = await db.areas.toArray();

      setAreas(
        localAreas.filter((area) => area.is_active !== false)
      );
    } catch (err) {
      setError(err.message || "Unable to load areas.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAreas();
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
    setNotice("");
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
    setNotice("");
    setShowForm(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();

    setError("");
    setNotice("");

    const areaName = form.name.trim();

    if (!areaName) {
      setError("Area name is required.");
      return;
    }

    try {
      setSaving(true);

      const cleanData = {
        name: areaName,
        area_type: form.area_type,
        district: form.district.trim(),
        description: form.description.trim(),
        updated_at: new Date().toISOString(),
      };

      await db.transaction("rw", db.areas, async () => {
        const existingAreas = await db.areas.toArray();

        const normalizedName = normalizeAreaName(areaName);

        const duplicateArea = existingAreas.find((area) => {
          if (area.is_active === false) return false;
          if (editingId && area.id === editingId) return false;

          return (
            normalizeAreaName(area.name) === normalizedName
          );
        });

        if (duplicateArea) {
          throw new Error("Area already exists!");
        }

        if (editingId) {
          await db.areas.update(editingId, cleanData);
        } else {
          const clientId = crypto.randomUUID();

          await db.areas.add({
            id: `local-${clientId}`,
            client_id: clientId,
            server_id: null,
            ...cleanData,
            is_active: true,
            synced: false,
            created_at: new Date().toISOString(),
          });
        }
      });

      setNotice(
        editingId
          ? "Area updated successfully."
          : "Area added successfully."
      );

      setShowForm(false);
      setForm(emptyForm);
      setEditingId(null);
      setSearch("");

      await loadAreas();
    } catch (err) {
      setError(err.message || "Unable to save area.");
    } finally {
      setSaving(false);
    }
  }

  function openDeleteModal(area) {
    setDeleteArea(area);
    setConfirmText("");
    setPassword("");
    setDeleteError("");
    setError("");
  }

  function closeDeleteModal() {
    if (saving) return;

    setDeleteArea(null);
    setConfirmText("");
    setPassword("");
    setDeleteError("");
  }

  async function confirmDeletion() {
    if (!deleteArea) return;

    if (!password.trim()) {
      setDeleteError("Please enter your device password.");
      return;
    }

    if (
      normalizeAreaName(confirmText) !==
      normalizeAreaName(requiredText)
    ) {
      setDeleteError("Area name does not match.");
      return;
    }

    try {
      setSaving(true);
      setDeleteError("");

      // Verify device password.
      await verifyDevicePassword(password);

      // Permanently delete only the selected area's data.
      await db.transaction(
        "rw",
        db.areas,
        db.shops,
        db.adjustments,
        async () => {
          // Get shops belonging to this exact area.
          const relatedShops = await db.shops
            .where("area_id")
            .equals(deleteArea.id)
            .toArray();

          const shopIds = relatedShops.map((shop) => shop.id);

          // Delete adjustments belonging only to these shops.
          if (shopIds.length > 0) {
            await db.adjustments
              .where("shop_id")
              .anyOf(shopIds)
              .delete();
          }

          // Delete only these shops.
          await db.shops.bulkDelete(shopIds);

          // Finally delete the selected area.
          await db.areas.delete(deleteArea.id);
        }
      );

      setNotice(
        `Area "${deleteArea.name}" and its ${" "}shops and adjustment history have been permanently deleted.`
      );

      setDeleteArea(null);
      setConfirmText("");
      setPassword("");

      await loadAreas();
    } catch (err) {
      setDeleteError(
        err.message || "Unable to delete area."
      );
    } finally {
      setSaving(false);
    }
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
        <span>Local Database</span>

        <button
          type="button"
          onClick={loadAreas}
          title="Refresh areas"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      <div className="areas-stats">
        <div className="area-stat-card">
          <div className="area-stat-icon">
            <MapPin size={22} />
          </div>
          <div>
            <h3>{areas.length}</h3>
            <p>Total Areas</p>
          </div>
        </div>

        <div className="area-stat-card">
          <div className="area-stat-icon">
            <Store size={22} />
          </div>
          <div>
            <h3>{totalVillages}</h3>
            <p>Villages</p>
          </div>
        </div>

        <div className="area-stat-card">
          <div className="area-stat-icon">
            <MapPin size={22} />
          </div>
          <div>
            <h3>{totalTowns}</h3>
            <p>Towns</p>
          </div>
        </div>
      </div>

      {notice && (
        <div className="area-notice">
          {notice}
          <button onClick={() => setNotice("")}>
            <X size={16} />
          </button>
        </div>
      )}

      {error && (
        <div className="area-error">
          <AlertTriangle size={17} />
          {error}
          <button onClick={() => setError("")}>
            <X size={16} />
          </button>
        </div>
      )}

      <div className="areas-toolbar">
        <div className="areas-search">
          <Search size={18} />
          <input
            id="area-search-filter"
            name="area-search-filter"
            type="search"
            placeholder="Search areas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
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
                <div className="area-card-icon">
                  <MapPin size={22} />
                </div>

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
                    title="Delete area permanently"
                    onClick={(e) => {
                      e.stopPropagation();
                      openDeleteModal(area);
                    }}
                  >
                    <Trash2 size={18} />
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

              <button
                type="button"
                onClick={() => setShowForm(false)}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <label>Area Name *</label>
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="Enter area name"
                autoComplete="off"
                required
              />

              <label>Area Type *</label>
              <select
                name="area_type"
                value={form.area_type}
                onChange={handleChange}
                required
              >
                <option value="VILLAGE">Village</option>
                <option value="TOWN">Town</option>
              </select>

              <label>District</label>
              <input
                name="district"
                value={form.district}
                onChange={handleChange}
                placeholder="Enter district"
                autoComplete="off"
              />

              <label>Description</label>
              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                placeholder="Optional description"
                rows={3}
                autoComplete="off"
              />

              {error && <p className="form-error">{error}</p>}

              <div className="area-modal-buttons">
                <button
                  type="button"
                  className="cancel-btn"
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="primary-btn"
                  disabled={saving}
                >
                  {saving
                    ? "Saving..."
                    : editingId
                      ? "Update Area"
                      : "Save Area"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteArea && (
        <div className="area-modal-overlay">
          <div className="area-modal deactivate-modal">
            <div className="area-modal-header">
              <div>
                <h2>Delete Area Permanently</h2>
                <p>This action cannot be undone.</p>
              </div>

              <button
                type="button"
                onClick={closeDeleteModal}
              >
                <X size={20} />
              </button>
            </div>

            <div className="deactivate-warning">
              <ShieldAlert size={24} />
              <p>
                You are about to permanently delete{" "}
                <strong>{deleteArea.name}</strong>, all its shops
                and their adjustment history. This data cannot
                be recovered from the application.
              </p>
            </div>

            <label>
              <LockKeyhole size={15} /> Device Password
            </label>

            <input
              type="password"
              name="area-device-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your device password"
              autoComplete="new-password"
            />

            <label>Enter this area's name to confirm:</label>

            <div className="confirmation-text">
              {requiredText}
            </div>

            <input
              type="text"
              name="area-deletion-confirmation"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Enter area name"
              autoComplete="off"
              spellCheck={false}
            />

            {deleteError && (
              <p className="form-error">{deleteError}</p>
            )}

            <div className="area-modal-buttons">
              <button
                type="button"
                className="cancel-btn"
                onClick={closeDeleteModal}
              >
                Cancel
              </button>

              <button
                type="button"
                className="primary-btn"
                disabled={
                  saving ||
                  !password.trim() ||
                  normalizeAreaName(confirmText) !==
                    normalizeAreaName(requiredText)
                }
                onClick={confirmDeletion}
              >
                {saving ? "Deleting..." : "Delete Permanently"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
