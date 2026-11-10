import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  Search,
  MapPin,
  Pencil,
  Trash2,
  X,
  RefreshCw,
  Store,
  ArrowRight,
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

  async function loadAreas() {
    try {
      setLoading(true);
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

  async function handleDeactivate(id, e) {
    e.stopPropagation();

    if (!window.confirm("Deactivate this area?")) return;

    try {
      await apiRequest(`/areas/${id}/deactivate`, {
        method: "PATCH",
      });

      await loadAreas();
    } catch (err) {
      setError(err.message);
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

      <div className="areas-heading">
        <div>
          <h1>Villages & Towns</h1>
          <p>Select an area to view its registered shops.</p>
        </div>

        <button className="add-area-btn" onClick={openAddForm}>
          <Plus size={18} /> Add Area
        </button>
      </div>

      <div className="area-stats">
        <div className="area-stat-card">
          <MapPin />
          <div>
            <span>Total Areas</span>
            <h2>{areas.length}</h2>
          </div>
        </div>

        <div className="area-stat-card">
          <Store />
          <div>
            <span>Villages</span>
            <h2>{totalVillages}</h2>
          </div>
        </div>

        <div className="area-stat-card">
          <MapPin />
          <div>
            <span>Towns</span>
            <h2>{totalTowns}</h2>
          </div>
        </div>
      </div>

      {error && <div className="area-error">{error}</div>}

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
          <RefreshCw size={17} /> Refresh
        </button>
      </div>

      <div className="areas-grid">

        {loading ? (
          <p>Loading areas...</p>
        ) : filteredAreas.length === 0 ? (
          <p>No areas found. Add your first area.</p>
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

                <span className="area-type-badge">
                  {area.area_type}
                </span>
              </div>

              <h3>{area.name}</h3>

              <p className="area-district">
                {area.district || "District not specified"}
              </p>

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
                </button>

                <button
                  title="Deactivate Area"
                  onClick={(e) => handleDeactivate(area.id, e)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))
        )}

      </div>

      {showForm && (
        <div className="area-modal-overlay">
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
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </button>

                <button type="submit">
                  {editingId ? "Update Area" : "Save Area"}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}