import { useEffect, useState } from "react";
import {
  Plus,
  Search,
  Store,
  Pencil,
  Trash2,
  X,
  RefreshCw,
  MessageCircle,
  MapPin,
} from "lucide-react";

import { apiRequest } from "../services/api";
import "./Shops.css";

export default function Shops() {
  const [shops, setShops] = useState([]);
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [areaFilter, setAreaFilter] = useState("ALL");

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [error, setError] = useState("");

  const emptyForm = {
    area_id: "",
    shop_name: "",
    owner_name: "",
    phone: "",
    whatsapp_number: "",
    address: "",
    notes: "",
    opening_balance: "0",
  };

  const [form, setForm] = useState(emptyForm);

  // LOAD SHOPS AND AREAS
  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const [shopResponse, areaResponse] = await Promise.all([
        apiRequest("/shops"),
        apiRequest("/areas"),
      ]);

      setShops(shopResponse.shops || []);
      setAreas(areaResponse.areas || []);
    } catch (err) {
      setError(err.message || "Failed to load shop information.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  // OPEN ADD FORM
  function openAddForm() {
    setEditingId(null);
    setForm({
      ...emptyForm,
      area_id: areas[0]?.id?.toString() || "",
    });
    setShowForm(true);
  }

  // OPEN EDIT FORM
  function openEditForm(shop) {
    setEditingId(shop.id);

    setForm({
      area_id: String(shop.area_id),
      shop_name: shop.shop_name || "",
      owner_name: shop.owner_name || "",
      phone: shop.phone || "",
      whatsapp_number: shop.whatsapp_number || "",
      address: shop.address || "",
      notes: shop.notes || "",
      opening_balance: String(shop.opening_balance ?? 0),
    });

    setShowForm(true);
  }

  // HANDLE FORM INPUTS
  function handleChange(e) {
    const { name, value } = e.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  // SAVE SHOP
  async function handleSubmit(e) {
    e.preventDefault();

    try {
      const endpoint = editingId
        ? `/shops/${editingId}`
        : "/shops";

      const payload = {
        ...form,
        area_id: Number(form.area_id),
        opening_balance: Number(form.opening_balance),
      };

      await apiRequest(endpoint, {
        method: editingId ? "PUT" : "POST",
        body: JSON.stringify(payload),
      });

      setShowForm(false);
      setForm(emptyForm);
      setEditingId(null);

      await loadData();
    } catch (err) {
      alert(err.message || "Failed to save shop.");
    }
  }

  // DEACTIVATE SHOP
  async function handleDeactivate(id) {
    const confirmed = window.confirm(
      "Are you sure you want to deactivate this shop?"
    );

    if (!confirmed) return;

    try {
      await apiRequest(`/shops/${id}/deactivate`, {
        method: "PATCH",
      });

      await loadData();
    } catch (err) {
      alert(err.message || "Failed to deactivate shop.");
    }
  }

  // WHATSAPP NUMBER FORMAT
  function getWhatsAppLink(number) {
    let digits = String(number || "").replace(/\D/g, "");

    // Convert Pakistani local mobile format to international format
    if (digits.startsWith("03")) {
      digits = "92" + digits.slice(1);
    } else if (digits.startsWith("3")) {
      digits = "92" + digits;
    }

    return digits
      ? `https://wa.me/${digits}`
      : null;
  }

  // SEARCH AND FILTER
  const filteredShops = shops.filter((shop) => {
    const searchText = search.toLowerCase();

    const matchesSearch =
      shop.shop_name?.toLowerCase().includes(searchText) ||
      shop.owner_name?.toLowerCase().includes(searchText) ||
      shop.phone?.toLowerCase().includes(searchText) ||
      shop.area_name?.toLowerCase().includes(searchText);

    const matchesArea =
      areaFilter === "ALL" ||
      String(shop.area_id) === areaFilter;

    return matchesSearch && matchesArea;
  });

  return (
    <div className="shops-page">

      {/* PAGE HEADING */}
      <div className="shops-heading">
        <div>
          <h1>Shops Management</h1>
          <p>Manage your customers and their shop information.</p>
        </div>

        <button
          className="add-shop-btn"
          onClick={openAddForm}
          disabled={areas.length === 0}
          title={areas.length === 0 ? "Add an area first" : ""}
        >
          <Plus size={19} />
          Add New Shop
        </button>
      </div>

      {/* STATISTICS */}
      <div className="shops-stats">

        <div className="shop-stat-card">
          <Store size={25} />
          <div>
            <span>Total Shops</span>
            <h2>{shops.length}</h2>
          </div>
        </div>

        <div className="shop-stat-card">
          <MapPin size={25} />
          <div>
            <span>Areas Covered</span>
            <h2>
              {new Set(shops.map((shop) => shop.area_id)).size}
            </h2>
          </div>
        </div>

        <div className="shop-stat-card">
          <Store size={25} />
          <div>
            <span>Filtered Shops</span>
            <h2>{filteredShops.length}</h2>
          </div>
        </div>

      </div>

      {/* SEARCH AND FILTER */}
      <div className="shops-toolbar">

        <div className="shops-search">
          <Search size={19} />

          <input
            placeholder="Search shop, owner, phone or area..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select
          value={areaFilter}
          onChange={(e) => setAreaFilter(e.target.value)}
        >
          <option value="ALL">All Areas</option>

          {areas.map((area) => (
            <option key={area.id} value={String(area.id)}>
              {area.name}
            </option>
          ))}
        </select>

        <button
          className="shops-refresh-btn"
          onClick={loadData}
          title="Refresh"
        >
          <RefreshCw size={18} />
        </button>

      </div>

      {error && (
        <div className="shops-error">{error}</div>
      )}

      {/* SHOPS TABLE */}
      <div className="shops-table-container">

        <table className="shops-table">

          <thead>
            <tr>
              <th>Shop Information</th>
              <th>Village / Town</th>
              <th>Owner</th>
              <th>Phone</th>
              <th>Opening Balance</th>
              <th>WhatsApp</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>

            {loading ? (
              <tr>
                <td colSpan="7" className="shops-empty">
                  Loading shops...
                </td>
              </tr>
            ) : filteredShops.length === 0 ? (
              <tr>
                <td colSpan="7" className="shops-empty">
                  No shops found. Add your first shop.
                </td>
              </tr>
            ) : (
              filteredShops.map((shop) => {
                const whatsappLink = getWhatsAppLink(
                  shop.whatsapp_number || shop.phone
                );

                return (
                  <tr key={shop.id}>

                    <td>
                      <div className="shop-info">
                        <div className="shop-avatar">
                          <Store size={20} />
                        </div>

                        <div>
                          <strong>{shop.shop_name}</strong>
                          <span>
                            {shop.address || "No address provided"}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td>
                      <span className="shop-area">
                        {shop.area_name}
                      </span>
                    </td>

                    <td>{shop.owner_name || "—"}</td>

                    <td>{shop.phone || "—"}</td>

                    <td className="shop-balance">
                      Rs. {Number(shop.opening_balance || 0).toLocaleString("en-PK")}
                    </td>

                    <td>
                      {whatsappLink ? (
                        <a
                          href={whatsappLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="whatsapp-btn"
                          title="Open WhatsApp"
                        >
                          <MessageCircle size={17} />
                          WhatsApp
                        </a>
                      ) : (
                        <span className="no-number">No number</span>
                      )}
                    </td>

                    <td>
                      <div className="shop-actions">

                        <button
                          onClick={() => openEditForm(shop)}
                          title="Edit shop"
                        >
                          <Pencil size={17} />
                        </button>

                        <button
                          onClick={() => handleDeactivate(shop.id)}
                          title="Deactivate shop"
                        >
                          <Trash2 size={17} />
                        </button>

                      </div>
                    </td>

                  </tr>
                );
              })
            )}

          </tbody>

        </table>

      </div>

      {/* ADD / EDIT MODAL */}
      {showForm && (
        <div className="shop-modal-overlay">

          <div className="shop-modal">

            <div className="shop-modal-header">
              <div>
                <h2>
                  {editingId ? "Edit Shop" : "Register New Shop"}
                </h2>

                <p>Enter the shop information below.</p>
              </div>

              <button onClick={() => setShowForm(false)}>
                <X size={21} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>

              <label>Shop Name *</label>

              <input
                name="shop_name"
                value={form.shop_name}
                onChange={handleChange}
                placeholder="e.g. Al Madina Cosmetics"
                required
              />

              <label>Village / Town *</label>

              <select
                name="area_id"
                value={form.area_id}
                onChange={handleChange}
                required
              >
                <option value="">Select Area</option>

                {areas.map((area) => (
                  <option key={area.id} value={String(area.id)}>
                    {area.name} ({area.area_type})
                  </option>
                ))}
              </select>

              <label>Owner Name</label>

              <input
                name="owner_name"
                value={form.owner_name}
                onChange={handleChange}
                placeholder="Shopkeeper name"
              />

              <div className="shop-form-row">

                <div>
                  <label>Phone Number</label>

                  <input
                    name="phone"
                    value={form.phone}
                    onChange={handleChange}
                    placeholder="03XXXXXXXXX"
                  />
                </div>

                <div>
                  <label>WhatsApp Number</label>

                  <input
                    name="whatsapp_number"
                    value={form.whatsapp_number}
                    onChange={handleChange}
                    placeholder="03XXXXXXXXX"
                  />
                </div>

              </div>

              <label>Shop Address</label>

              <input
                name="address"
                value={form.address}
                onChange={handleChange}
                placeholder="Market, street or location"
              />

              <label>Opening Balance (Rs.)</label>

              <input
                type="number"
                name="opening_balance"
                min="0"
                step="0.01"
                value={form.opening_balance}
                onChange={handleChange}
              />

              <label>Additional Notes</label>

              <textarea
                name="notes"
                rows="3"
                value={form.notes}
                onChange={handleChange}
                placeholder="Optional information..."
              />

              <div className="shop-modal-actions">

                <button
                  type="button"
                  className="shop-cancel-btn"
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="shop-save-btn"
                >
                  {editingId ? "Update Shop" : "Save Shop"}
                </button>

              </div>

            </form>

          </div>

        </div>
      )}

    </div>
  );
}