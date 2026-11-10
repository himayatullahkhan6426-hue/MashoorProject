
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Store,
  Search,
  MapPin,
  Phone,
  MessageCircle,
  Plus,
  RefreshCw,
  Pencil,
  Trash2,
  X,
} from "lucide-react";

import { apiRequest } from "../services/api";
import "./AreaShops.css";

export default function AreaShops() {
  const { areaId } = useParams();
  const navigate = useNavigate();

  const [area, setArea] = useState(null);
  const [shops, setShops] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  const [deleteShop, setDeleteShop] = useState(null);
  const [deletePassword, setDeletePassword] = useState("");
  const [deletePhrase, setDeletePhrase] = useState("");

  const emptyForm = {
    area_id: String(areaId),
    shop_name: "",
    owner_name: "",
    phone: "",
    whatsapp_number: "",
    address: "",
    notes: "",
    opening_balance: "0",
  };

  const [form, setForm] = useState(emptyForm);

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const [areasResponse, shopsResponse] = await Promise.all([
        apiRequest("/areas"),
        apiRequest(`/shops?area_id=${areaId}`),
      ]);

      const selectedArea = (areasResponse.areas || []).find(
        (item) => String(item.id) === String(areaId)
      );

      setArea(selectedArea || null);
      setShops(shopsResponse.shops || []);
    } catch (err) {
      setError(err.message || "Unable to load area information.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [areaId]);

  function openAddForm() {
    setEditingId(null);
    setForm({
      ...emptyForm,
      area_id: String(areaId),
    });
    setShowForm(true);
  }

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

  function handleChange(e) {
    const { name, value } = e.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();

    try {
      setSaving(true);

      const endpoint = editingId
        ? `/shops/${editingId}`
        : "/shops";

      const payload = {
        ...form,
        area_id: Number(areaId),
        opening_balance: Number(form.opening_balance),
      };

      await apiRequest(endpoint, {
        method: editingId ? "PUT" : "POST",
        body: JSON.stringify(payload),
      });

      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm);

      await loadData();
    } catch (err) {
      alert(err.message || "Failed to save shop.");
    } finally {
      setSaving(false);
    }
  }

  function openDeleteModal(shop) {
    setDeleteShop(shop);
    setDeletePassword("");
    setDeletePhrase("");
  }

  function closeDeleteModal() {
    setDeleteShop(null);
    setDeletePassword("");
    setDeletePhrase("");
  }

  function proceedWithDelete() {
    if (!deletePassword.trim()) {
      alert("Please enter your account password.");
      return;
    }

    const requiredPhrase =
      `Delete shop ${deleteShop.shop_name} and it's related all records`;

    if (deletePhrase !== requiredPhrase) {
      alert("The confirmation phrase does not match.");
      return;
    }

    const confirmed = window.confirm(
      "Caution, this will delete all details of shop, are you agree to do this?"
    );

    if (!confirmed) return;

    // Permanent deletion will be connected during the backend stage.
    // A frontend-only password field cannot securely verify the password.
    alert(
      "The confirmation process is complete. Permanent shop deletion is not connected yet. No data has been deleted."
    );

    closeDeleteModal();
  }

  function getWhatsAppLink(number) {
    let digits = String(number || "").replace(/\D/g, "");

    if (digits.startsWith("03")) {
      digits = "92" + digits.slice(1);
    } else if (digits.startsWith("3")) {
      digits = "92" + digits;
    }

    return digits ? `https://wa.me/${digits}` : null;
  }

  const filteredShops = shops.filter((shop) =>
    `${shop.shop_name || ""} ${shop.owner_name || ""} ${shop.phone || ""}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  if (loading) {
    return <div className="area-shops-message">Loading shops...</div>;
  }

  if (!area) {
    return (
      <div className="area-shops-message">
        <h2>Area not found</h2>
        <button onClick={() => navigate("/areas")}>
          Back to Areas
        </button>
      </div>
    );
  }

  return (
    <div className="area-shops-page">

      <button
        className="area-back-btn"
        onClick={() => navigate("/areas")}
      >
        <ArrowLeft size={18} />
        Back to Areas
      </button>

      <div className="area-shops-heading">
        <div>
          <div className="area-title-label">
            <MapPin size={16} />
            {area.area_type}
          </div>

          <h1>{area.name}</h1>

          <p>
            {area.district || "No district specified"} · {shops.length} registered shops
          </p>
        </div>

        <button
          className="area-add-shop-btn"
          onClick={openAddForm}
        >
          <Plus size={18} />
          Add New Shop
        </button>
      </div>

      {error && (
        <div className="area-shops-error">{error}</div>
      )}

      <div className="area-shops-toolbar">
        <div className="area-shops-search">
          <Search size={19} />
          <input
            placeholder="Search shops in this area..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <button
          className="area-refresh-btn"
          onClick={loadData}
        >
          <RefreshCw size={17} />
          Refresh
        </button>
      </div>

      {filteredShops.length === 0 ? (
        <div className="area-shops-empty">
          <Store size={42} />
          <h3>No shops found</h3>
          <p>
            {search
              ? "Try another search."
              : "There are no registered shops in this area yet."}
          </p>
          {!search && (
            <button
              className="area-add-shop-btn"
              onClick={openAddForm}
            >
              <Plus size={17} />
              Add First Shop
            </button>
          )}
        </div>
      ) : (
        <div className="area-shop-grid">
          {filteredShops.map((shop) => {
            const whatsappLink = getWhatsAppLink(
              shop.whatsapp_number || shop.phone
            );

            return (
              <div className="area-shop-card" key={shop.id}>
                <div
                  className="area-shop-main"
                  onClick={() => navigate(`/shops/${shop.id}`)}
                >
                  <div className="area-shop-card-top">
                    <div className="area-shop-icon">
                      <Store size={23} />
                    </div>

                    <span className="area-shop-status">Active</span>
                  </div>

                  <h3>{shop.shop_name}</h3>

                  <p className="area-shop-owner">
                    Owner: {shop.owner_name || "Not provided"}
                  </p>

                  <div className="area-shop-contact">
                    <Phone size={15} />
                    <span>{shop.phone || "No phone number"}</span>
                  </div>

                  <div className="area-shop-card-footer">
                    <span>View Shop Dashboard</span>
                    <ArrowLeft className="area-shop-arrow" size={17} />
                  </div>
                </div>

                <div className="area-shop-actions">
                  {whatsappLink && (
                    <a
                      className="area-shop-whatsapp"
                      href={whatsappLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      title="Contact on WhatsApp"
                    >
                      <MessageCircle size={17} />
                    </a>
                  )}

                  <button
                    className="area-shop-edit"
                    onClick={() => openEditForm(shop)}
                    title="Edit shop"
                  >
                    <Pencil size={16} />
                  </button>

                  <button
                    className="area-shop-delete"
                    onClick={() => openDeleteModal(shop)}
                    title="Delete shop"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ADD / EDIT SHOP MODAL */}
      {showForm && (
        <div className="area-modal-overlay">
          <div className="area-shop-modal">
            <div className="area-modal-header">
              <div>
                <h2>{editingId ? "Edit Shop" : "Register New Shop"}</h2>
                <p>Shop will be registered under {area.name}.</p>
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

              <label>Village / Town</label>
              <input value={area.name} disabled />

              <label>Owner Name</label>
              <input
                name="owner_name"
                value={form.owner_name}
                onChange={handleChange}
                placeholder="Shopkeeper name"
              />

              <div className="area-form-row">
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

              <div className="area-modal-actions">
                <button
                  type="button"
                  className="area-cancel-btn"
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="area-save-btn"
                  disabled={saving}
                >
                  {saving
                    ? "Saving..."
                    : editingId
                    ? "Update Shop"
                    : "Save Shop"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteShop && (
        <div className="area-modal-overlay">
          <div className="area-shop-modal delete-shop-modal">
            <div className="area-modal-header">
              <div>
                <h2>Delete Shop</h2>
                <p>This action requires account confirmation.</p>
              </div>

              <button onClick={closeDeleteModal}>
                <X size={21} />
              </button>
            </div>

            <div className="delete-warning">
              <Trash2 size={22} />
              <span>
                You are preparing to delete <strong>{deleteShop.shop_name}</strong>.
              </span>
            </div>

            <label>Account Password</label>
            <input
              type="password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              placeholder="Enter your account password"
            />

            <label>Type this exact confirmation phrase</label>
            <div className="delete-required-phrase">
              Delete shop {deleteShop.shop_name} and it's related all records
            </div>

            <textarea
              rows="3"
              value={deletePhrase}
              onChange={(e) => setDeletePhrase(e.target.value)}
              placeholder="Type the confirmation phrase here..."
            />

            <div className="area-modal-actions">
              <button
                className="area-cancel-btn"
                onClick={closeDeleteModal}
              >
                Cancel
              </button>

              <button
                className="area-delete-confirm-btn"
                onClick={proceedWithDelete}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
