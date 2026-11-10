
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus, Search, MapPin, Pencil, Trash2, X,
  RefreshCw, Store, ArrowRight, AlertTriangle,
  LockKeyhole, ShieldAlert
} from "lucide-react";

import { apiRequest } from "../services/api";
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

  const [deleteArea, setDeleteArea] = useState(null);
  const [deletePassword, setDeletePassword] = useState("");
  const [confirmationText, setConfirmationText] = useState("");
  const [deleteStage, setDeleteStage] = useState(1);

  async function loadAreas() {
    try {
      setLoading(true);
      setError("");

      const response = await apiRequest("/areas");
      setAreas(response.areas || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAreas();
  }, []);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
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
      name: area.name,
      area_type: area.area_type,
      district: area.district || "",
      description: area.description || "",
    });

    setError("");
    setShowForm(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    try {
      const endpoint = editingId
        ? `/areas/${editingId}`
        : "/areas";

      await apiRequest(endpoint, {
        method: editingId ? "PUT" : "POST",
        body: JSON.stringify(form),
      });

      setShowForm(false);
      setForm(emptyForm);
      setEditingId(null);
      await loadAreas();
    } catch (err) {
      setError(err.message);
    }
  }

  function openDeleteDialog(area, e) {
    e.stopPropagation();

    setDeleteArea(area);
    setDeletePassword("");
    setConfirmationText("");
    setDeleteStage(1);
    setError("");
    setNotice("");
  }

  function closeDeleteDialog() {
    setDeleteArea(null);
    setDeletePassword("");
    setConfirmationText("");
    setDeleteStage(1);
  }

  const requiredPhrase = deleteArea
    ? `Delete Area ${deleteArea.name} and it's related all shops`
    : "";

  function proceedToFinalConfirmation() {
    if (!deletePassword.trim()) {
      setError("Please enter your account password.");
      return;
    }

    if (confirmationText !== requiredPhrase) {
      setError("The confirmation text does not match.");
      return;
    }

    setError("");
    setDeleteStage(2);
  }

  function confirmAreaDeletion() {
    if (!deleteArea) return;

    // FRONTEND PREVIEW ONLY:
    // Actual password verification and permanent deletion
    // will be implemented through the backend later.
    setAreas((previous) =>
      previous.filter((area) => area.id !== deleteArea.id)
    );

    setNotice(
      `${deleteArea.name} was removed from this frontend preview. Backend deletion is not connected yet.`
    );

    closeDeleteDialog();
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

      <div className="areas-heading">
        <div>
          <div className="areas-eyebrow">LOCATION MANAGEMENT</div>
          <h1>Villages & Towns</h1>
          <p>Manage your business areas and explore registered shops.</p>
        </div>

        <button className="add-area-btn" onClick={openAddForm}>
          <Plus size={18} />
          Add Area
        </button>
      </div>

      <div className="area-stats">
        <div className="area-stat-card">
          <div className="area-stat-icon purple">
            <MapPin size={22} />
          </div>
          <div>
            <span>Total Areas</span>
            <h2>{areas.length}</h2>
          </div>
        </div>

        <div className="area-stat-card">
          <div className="area-stat-icon green">
            <Store size={22} />
          </div>
          <div>
            <span>Villages</span>
            <h2>{totalVillages}</h2>
          </div>
        </div>

        <div className="area-stat-card">
          <div className="area-stat-icon blue">
            <MapPin size={22} />
          </div>
          <div>
            <span>Towns</span>
            <h2>{totalTowns}</h2>
          </div>
        </div>
      </div>

      {error && !showForm && !deleteArea && (
        <div className="area-error">{error}</div>
      )}

      {notice && (
        <div className="area-notice">
          {notice}
          <button onClick={() => setNotice("")}>
            <X size={16} />
          </button>
        </div>
      )}

      <div className="areas-toolbar">
        <div className="areas-search">
          <Search size={18} />
          <input
            placeholder="Search villages or towns..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <button className="refresh-btn" onClick={loadAreas}>
          <RefreshCw size={17} />
          Refresh
        </button>
      </div>

      <div className="areas-section-heading">
        <div>
          <h2>All Areas</h2>
          <p>{filteredAreas.length} areas found</p>
        </div>
      </div>

      <div className="areas-grid">
        {loading ? (
          <div className="areas-empty">Loading areas...</div>
        ) : filteredAreas.length === 0 ? (
          <div className="areas-empty">
            <MapPin size={35} />
            <h3>No areas found</h3>
            <p>Add your first village or town to get started.</p>
            <button onClick={openAddForm}>
              <Plus size={17} /> Add Area
            </button>
          </div>
        ) : (
          filteredAreas.map((area) => (
            <div
              className="area-card"
              key={area.id}
              onClick={() => navigate(`/areas/${area.id}/shops`)}
            >
              <div className="area-card-top">
                <div className="area-icon">
                  <MapPin size={23} />
                </div>

                <span className={`area-type-badge ${area.area_type.toLowerCase()}`}>
                  {area.area_type}
                </span>
              </div>

              <h3>{area.name}</h3>

              <p className="area-district">
                {area.district || "District not specified"}
              </p>

              {area.description && (
                <p className="area-description">
                  {area.description}
                </p>
              )}

              <div className="area-card-footer">
                <span>View Shops</span>
                <ArrowRight size={18} />
              </div>

              <div className="area-card-actions">
                <button
                  title="Edit Area"
                  onClick={(e) => openEditForm(area, e)}
                >
                  <Pencil size={16} />
                  Edit
                </button>

                <button
                  className="delete-area-action"
                  title="Delete Area"
                  onClick={(e) => openDeleteDialog(area, e)}
                >
                  <Trash2 size={16} />
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ADD / EDIT AREA MODAL */}
      {showForm && (
        <div
          className="area-modal-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowForm(false);
          }}
        >
          <div className="area-modal">
            <div className="area-modal-header">
              <div>
                <h2>{editingId ? "Edit Area" : "Add New Area"}</h2>
                <p>Enter the village or town details.</p>
              </div>

              <button onClick={() => setShowForm(false)}>
                <X />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <label>
                Area Name *
                <input
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="e.g. Timergara"
                  required
                />
              </label>

              <label>
                Area Type *
                <select
                  name="area_type"
                  value={form.area_type}
                  onChange={handleChange}
                >
                  <option value="VILLAGE">Village</option>
                  <option value="TOWN">Town</option>
                </select>
              </label>

              <label>
                District
                <input
                  name="district"
                  value={form.district}
                  onChange={handleChange}
                  placeholder="e.g. Lower Dir"
                />
              </label>

              <label>
                Description
                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  placeholder="Additional information..."
                  rows="3"
                />
              </label>

              {error && <div className="area-error">{error}</div>}

              <div className="area-form-actions">
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </button>

                <button type="submit" className="primary-btn">
                  {editingId ? "Update Area" : "Save Area"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE AREA SECURITY MODAL */}
      {deleteArea && (
        <div className="area-modal-overlay">
          <div className="area-modal delete-modal">

            {deleteStage === 1 ? (
              <>
                <div className="delete-modal-icon">
                  <LockKeyhole size={28} />
                </div>

                <div className="delete-modal-heading">
                  <h2>Delete Area</h2>
                  <p>
                    Security verification is required to delete
                    <strong> {deleteArea.name}</strong>.
                  </p>
                </div>

                <div className="delete-warning">
                  <AlertTriangle size={19} />
                  <span>
                    This action will remove the area and all shops
                    associated with it. Their records may also be affected.
                  </span>
                </div>

                <label>
                  Account Password
                  <input
                    type="password"
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    placeholder="Enter your account password"
                  />
                </label>

                <label>
                  Type this exact confirmation phrase:
                  <div className="confirmation-phrase">
                    {requiredPhrase}
                  </div>
                  <input
                    value={confirmationText}
                    onChange={(e) => setConfirmationText(e.target.value)}
                    placeholder="Type the confirmation phrase"
                  />
                </label>

                {error && <div className="area-error">{error}</div>}

                <div className="area-form-actions">
                  <button
                    className="secondary-btn"
                    onClick={closeDeleteDialog}
                  >
                    Cancel
                  </button>

                  <button
                    className="danger-btn"
                    onClick={proceedToFinalConfirmation}
                  >
                    Continue
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="delete-modal-icon danger-icon">
                  <ShieldAlert size={30} />
                </div>

                <div className="delete-modal-heading">
                  <h2>Final Confirmation</h2>
                  <p>
                    Are you absolutely sure you want to delete
                    <strong> {deleteArea.name}</strong>?
                  </p>
                </div>

                <div className="delete-final-warning">
                  <h3><AlertTriangle size={18} /> Caution!</h3>
                  <p>
                    This will delete the area, all related shops,
                    and their associated records. Are you sure you
                    agree to proceed?
                  </p>
                  <strong>This action cannot be undone.</strong>
                </div>

                <div className="area-form-actions">
                  <button
                    className="secondary-btn"
                    onClick={() => setDeleteStage(1)}
                  >
                    Go Back
                  </button>

                  <button
                    className="danger-btn"
                    onClick={confirmAreaDeletion}
                  >
                    Yes, Delete Area
                  </button>
                </div>
              </>
            )}

          </div>
        </div>
      )}

    </div>
  );
}
