
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Plus,
  Search,
  RefreshCw,
  Store,
  Phone,
  MapPin,
  MessageCircle,
  Pencil,
  Trash2,
  X,
  AlertTriangle,
  LockKeyhole,
} from "lucide-react";

import { db } from "../database/localDb";
import {
  getLocalAreaShops,
  createLocalShop,
  updateLocalShop,
  deactivateLocalShop,
} from "../services/localShopStorage";
import { loginLocalUser } from "../services/localAuth";
import { useAuth } from "../context/AuthContext";

import "./AreaShops.css";

const emptyForm = {
  shop_name: "",
  owner_name: "",
  phone: "",
  whatsapp_number: "",
  address: "",
  notes: "",
  opening_balance: "0",
};

export default function AreaShops() {
  const { areaId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [area, setArea] = useState(null);
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editingShop, setEditingShop] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const [deleteShop, setDeleteShop] = useState(null);
  const [deletePassword, setDeletePassword] = useState("");
  const [deletePhrase, setDeletePhrase] = useState("");
  const [deactivating, setDeactivating] = useState(false);

  const [error, setError] = useState("");

  const loadData = async () => {
    try {
      setLoading(true);
      setError("");

      const areas = await db.areas.toArray();

      const selectedArea = areas.find(
        (item) => String(item.id) === String(areaId)
      );

      if (!selectedArea) {
        setArea(null);
        setShops([]);
        setError("Area not found.");
        return;
      }

      setArea(selectedArea);

      const localShops = await getLocalAreaShops(selectedArea.id);
      setShops(localShops);
    } catch (err) {
      console.error("Area shops loading error:", err);
      setError("Unable to load shops from local database.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [areaId]);

  const filteredShops = useMemo(() => {
    const value = search.toLowerCase().trim();

    if (!value) return shops;

    return shops.filter((shop) =>
      [
        shop.shop_name,
        shop.owner_name,
        shop.phone,
        shop.whatsapp_number,
        shop.address,
      ]
        .filter(Boolean)
        .some((item) => String(item).toLowerCase().includes(value))
    );
  }, [shops, search]);

  const openAddModal = () => {
    setEditingShop(null);
    setForm(emptyForm);
    setError("");
    setShowModal(true);
  };

  const openEditModal = (shop) => {
    setEditingShop(shop);

    setForm({
      shop_name: shop.shop_name || "",
      owner_name: shop.owner_name || "",
      phone: shop.phone || "",
      whatsapp_number: shop.whatsapp_number || "",
      address: shop.address || "",
      notes: shop.notes || "",
      opening_balance: String(shop.opening_balance ?? 0),
    });

    setError("");
    setShowModal(true);
  };

  const closeModal = () => {
    if (saving) return;

    setShowModal(false);
    setEditingShop(null);
    setForm(emptyForm);
    setError("");
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();

    if (!area) return;

    if (!form.shop_name.trim()) {
      setError("Shop name is required.");
      return;
    }

    const openingBalance = Number(form.opening_balance);

    if (!Number.isFinite(openingBalance) || openingBalance < 0) {
      setError("Please enter a valid opening balance.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const data = {
        ...form,
        area_id: area.id,
        opening_balance: openingBalance,
      };

      if (editingShop) {
        await updateLocalShop(editingShop.id, data);
      } else {
        await createLocalShop(data);
      }

      setShowModal(false);
      setEditingShop(null);
      setForm(emptyForm);

      await loadData();
    } catch (err) {
      console.error("Shop save error:", err);
      setError(err.message || "Unable to save shop.");
    } finally {
      setSaving(false);
    }
  };

  const openDeactivateModal = (shop) => {
    setDeleteShop(shop);
    setDeletePassword("");
    setDeletePhrase("");
    setError("");
  };

  const closeDeactivateModal = () => {
    if (deactivating) return;

    setDeleteShop(null);
    setDeletePassword("");
    setDeletePhrase("");
    setError("");
  };

  const expectedPhrase = deleteShop
    ? `Deactivate shop ${deleteShop.shop_name} and preserve all related records`
    : "";

  const handleDeactivate = async (e) => {
    e.preventDefault();

    if (!deleteShop || !user?.username) {
      setError("Unable to verify the current user.");
      return;
    }

    if (!deletePassword) {
      setError("Please enter your account password.");
      return;
    }

    if (deletePhrase !== expectedPhrase) {
      setError("Confirmation phrase does not match.");
      return;
    }

    try {
      setDeactivating(true);
      setError("");

      const authenticatedUser = await loginLocalUser(
        user.username,
        deletePassword
      );

      if (!authenticatedUser) {
        setError("Incorrect account password.");
        return;
      }

      await deactivateLocalShop(deleteShop.id);

      setDeleteShop(null);
      setDeletePassword("");
      setDeletePhrase("");

      await loadData();
    } catch (err) {
      console.error("Shop deactivation error:", err);
      setError(err.message || "Unable to deactivate shop.");
    } finally {
      setDeactivating(false);
    }
  };

  const openWhatsApp = (shop) => {
    const number = (
      shop.whatsapp_number ||
      shop.phone ||
      ""
    ).replace(/\D/g, "");

    if (!number) return;

    window.open(
      `https://wa.me/${number}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

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
          <span className="area-title-label">
            AREA MANAGEMENT
          </span>

          <h1>{area?.name || "Area Shops"}</h1>

          <p>
            Manage all shops registered in this area.
          </p>
        </div>

        <button
          className="area-add-shop-btn"
          onClick={openAddModal}
          disabled={!area || area.is_active === false}
        >
          <Plus size={18} />
          Add Shop
        </button>
      </div>

      <div className="area-shops-toolbar">
        <div className="area-shops-search">
          <Search size={18} />

          <input
            type="text"
            placeholder="Search shops, owners, phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <button
          className="area-refresh-btn"
          onClick={loadData}
          disabled={loading}
          title="Refresh shops"
        >
          <RefreshCw
            size={18}
            className={loading ? "spin" : ""}
          />
        </button>
      </div>

      {error && !showModal && !deleteShop && (
        <div className="area-shops-error">
          {error}
        </div>
      )}

      {loading ? (
        <div className="area-shops-empty">
          Loading shops...
        </div>
      ) : filteredShops.length === 0 ? (
        <div className="area-shops-empty">
          <Store size={42} />

          <h3>
            {search ? "No matching shops found" : "No shops yet"}
          </h3>

          <p>
            {search
              ? "Try another search term."
              : "Add the first shop to this area."}
          </p>
        </div>
      ) : (
        <div className="area-shop-grid">
          {filteredShops.map((shop) => (
            <div className="area-shop-card" key={shop.id}>
              <div className="area-shop-main">
                <div className="area-shop-icon">
                  <Store size={23} />
                </div>

                <div className="area-shop-info">
                  <h3>{shop.shop_name}</h3>

                  <p>
                    {shop.owner_name || "Owner not specified"}
                  </p>
                </div>
              </div>

              <div className="area-shop-details">
                {shop.phone && (
                  <div>
                    <Phone size={15} />
                    <span>{shop.phone}</span>
                  </div>
                )}

                {shop.address && (
                  <div>
                    <MapPin size={15} />
                    <span>{shop.address}</span>
                  </div>
                )}

                <div className="area-shop-balance">
                  <span>Opening Unpaid</span>
                  <strong>
                    Rs.{" "}
                    {Number(shop.opening_balance || 0).toLocaleString()}
                  </strong>
                </div>
              </div>

              <div className="area-shop-actions">
                <button
                  className="area-shop-whatsapp"
                  onClick={() => openWhatsApp(shop)}
                  disabled={!shop.whatsapp_number && !shop.phone}
                  title="WhatsApp"
                >
                  <MessageCircle size={16} />
                  WhatsApp
                </button>

                <button
                  className="area-shop-edit"
                  onClick={() => openEditModal(shop)}
                  title="Edit shop"
                >
                  <Pencil size={16} />
                </button>

                <button
                  className="area-shop-delete"
                  onClick={() => openDeactivateModal(shop)}
                  title="Deactivate shop"
                >
                  <Trash2 size={16} />
                </button>

                <button
                  className="area-shop-open"
                  onClick={() => navigate(`/shops/${shop.id}`)}
                >
                  Open
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="area-modal-overlay">
          <div className="area-shop-modal">
            <div className="area-modal-header">
              <div>
                <h2>
                  {editingShop ? "Edit Shop" : "Add New Shop"}
                </h2>
                <p>
                  {editingShop
                    ? "Update shop information."
                    : "Enter the new shop details."}
                </p>
              </div>

              <button onClick={closeModal} type="button">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSave}>
              <div className="area-form-row">
                <label>Shop Name *</label>
                <input
                  name="shop_name"
                  value={form.shop_name}
                  onChange={handleChange}
                  placeholder="Enter shop name"
                  required
                />
              </div>

              <div className="area-form-row">
                <label>Owner Name</label>
                <input
                  name="owner_name"
                  value={form.owner_name}
                  onChange={handleChange}
                  placeholder="Enter owner name"
                />
              </div>

              <div className="area-form-row">
                <label>Phone Number</label>
                <input
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  placeholder="Enter phone number"
                />
              </div>

              <div className="area-form-row">
                <label>WhatsApp Number</label>
                <input
                  name="whatsapp_number"
                  value={form.whatsapp_number}
                  onChange={handleChange}
                  placeholder="Enter WhatsApp number"
                />
              </div>

              <div className="area-form-row">
                <label>Address</label>
                <input
                  name="address"
                  value={form.address}
                  onChange={handleChange}
                  placeholder="Enter shop address"
                />
              </div>

              <div className="area-form-row">
                <label>Opening Unpaid</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  name="opening_balance"
                  value={form.opening_balance}
                  onChange={handleChange}
                  placeholder="0"
                />
              </div>

              <div className="area-form-row">
                <label>Notes</label>
                <textarea
                  name="notes"
                  value={form.notes}
                  onChange={handleChange}
                  placeholder="Additional notes..."
                  rows={3}
                />
              </div>

              {error && (
                <div className="area-shops-error">
                  {error}
                </div>
              )}

              <div className="area-modal-actions">
                <button
                  type="button"
                  className="area-cancel"
                  onClick={closeModal}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="area-save"
                  disabled={saving}
                >
                  {saving
                    ? "Saving..."
                    : editingShop
                    ? "Update Shop"
                    : "Save Shop"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteShop && (
        <div className="area-modal-overlay">
          <div className="area-shop-modal area-delete-modal">
            <div className="area-modal-header">
              <div>
                <h2>Deactivate Shop</h2>
                <p>
                  This shop will become inactive. Its related records
                  and financial history will be preserved.
                </p>
              </div>

              <button
                type="button"
                onClick={closeDeactivateModal}
              >
                <X size={20} />
              </button>
            </div>

            <div className="area-delete-warning">
              <AlertTriangle size={20} />
              <span>
                Shop: <strong>{deleteShop.shop_name}</strong>
              </span>
            </div>

            <form onSubmit={handleDeactivate}>
              <div className="area-form-row">
                <label>
                  <LockKeyhole size={15} />
                  Account Password
                </label>

                <input
                  type="password"
                  value={deletePassword}
                  onChange={(e) =>
                    setDeletePassword(e.target.value)
                  }
                  placeholder="Enter your account password"
                  required
                />
              </div>

              <div className="area-form-row">
                <label>
                  Type this confirmation phrase exactly:
                </label>

                <div className="area-delete-phrase">
                  {expectedPhrase}
                </div>

                <input
                  type="text"
                  value={deletePhrase}
                  onChange={(e) =>
                    setDeletePhrase(e.target.value)
                  }
                  placeholder="Type confirmation phrase"
                  required
                  autoComplete="off"
                />
              </div>

              {error && (
                <div className="area-shops-error">
                  {error}
                </div>
              )}

              <div className="area-modal-actions">
                <button
                  type="button"
                  className="area-cancel"
                  onClick={closeDeactivateModal}
                  disabled={deactivating}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="area-delete-confirm-btn"
                  disabled={deactivating}
                >
                  {deactivating
                    ? "Deactivating..."
                    : "Confirm Deactivation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
