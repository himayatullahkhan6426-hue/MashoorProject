
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
} from "../services/localShopStorage";
import { verifyDevicePassword } from "../services/localAuth";

import "./AreaShops.css";

const emptyForm = {
  shop_name: "",
  owner_name: "",
  phone: "",
  whatsapp_number: "",
  address: "",
  notes: "",
  unpaid_balance: "0",
};

export default function AreaShops() {
  const { areaId } = useParams();
  const navigate = useNavigate();

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
  const [deleting, setDeleting] = useState(false);

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
      unpaid_balance: String(
        shop.unpaid_balance ?? shop.opening_balance ?? 0
      ),
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

    const unpaidBalance = Number(form.unpaid_balance);

    if (!Number.isFinite(unpaidBalance) || unpaidBalance < 0) {
      setError("Please enter a valid unpaid balance.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const data = {
        shop_name: form.shop_name.trim(),
        owner_name: form.owner_name,
        phone: form.phone,
        whatsapp_number: form.whatsapp_number,
        address: form.address,
        notes: form.notes,
        area_id: area.id,
        unpaid_balance: unpaidBalance,
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

  const openDeleteModal = (shop) => {
    setDeleteShop(shop);
    setDeletePassword("");
    setDeletePhrase("");
    setError("");
  };

  const closeDeleteModal = () => {
    if (deleting) return;

    setDeleteShop(null);
    setDeletePassword("");
    setDeletePhrase("");
    setError("");
  };

  // Confirmation now requires only the exact shop name.
  const expectedPhrase = deleteShop
    ? deleteShop.shop_name
    : "";

  const handleDelete = async (e) => {
    e.preventDefault();

    if (!deleteShop) {
      setError("No shop selected.");
      return;
    }

    if (!deletePassword) {
      setError("Please enter your device password.");
      return;
    }

    if (deletePhrase !== expectedPhrase) {
      setError("Shop name does not match.");
      return;
    }

    try {
      setDeleting(true);
      setError("");

      const isPasswordValid =
        await verifyDevicePassword(deletePassword);

      if (!isPasswordValid) {
        setError("Incorrect device password.");
        return;
      }

      await db.transaction(
        "rw",
        db.shops,
        db.adjustments,
        async () => {
          const shop = await db.shops.get(deleteShop.id);

          if (!shop) {
            throw new Error("Shop not found.");
          }

          await db.adjustments
            .where("shop_id")
            .equals(shop.id)
            .delete();

          await db.shops.delete(shop.id);
        }
      );

      setDeleteShop(null);
      setDeletePassword("");
      setDeletePhrase("");

      await loadData();
    } catch (err) {
      console.error("Permanent shop deletion error:", err);
      setError(err.message || "Unable to permanently delete shop.");
    } finally {
      setDeleting(false);
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

          <p>Manage all shops registered in this area.</p>
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
            type="search"
            id="area-shops-search"
            name="area-shops-search"
            placeholder="Search shops, owners, phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
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
        <div className="area-shops-error">{error}</div>
      )}

      {loading ? (
        <div className="area-shops-empty">Loading shops...</div>
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
                  <span>Unpaid</span>

                  <strong>
                    Rs.{" "}
                    {Number(
                      shop.unpaid_balance ??
                      shop.opening_balance ??
                      0
                    ).toLocaleString()}
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
                  onClick={() => openDeleteModal(shop)}
                  title="Permanently delete shop"
                >
                  <Trash2 size={16} />
                </button>

                <button
                  className="area-shop-open"
                  onClick={() => navigate(`/area/${shop.id}`)}
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
                <label>Unpaid</label>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  name="unpaid_balance"
                  value={form.unpaid_balance}
                  onChange={handleChange}
                  placeholder="Enter unpaid amount"
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
                <div className="area-shops-error">{error}</div>
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
                <h2>Delete Shop Permanently</h2>

                <p>
                  This action cannot be undone. The shop and
                  its complete adjustment history will be deleted.
                </p>
              </div>

              <button
                type="button"
                onClick={closeDeleteModal}
              >
                <X size={20} />
              </button>
            </div>

            <div className="area-delete-warning">
              <AlertTriangle size={20} />

              <span>
                Shop: <strong>{deleteShop.shop_name}</strong>
                <br />
                All related adjustment history will also be deleted.
              </span>
            </div>

            <form onSubmit={handleDelete}>
              <div className="area-form-row">
                <label>
                  <LockKeyhole size={15} />
                  Device Password
                </label>

                <input
                  type="password"
                  value={deletePassword}
                  onChange={(e) =>
                    setDeletePassword(e.target.value)
                  }
                  placeholder="Enter your device password"
                  autoComplete="new-password"
                  required
                />
              </div>

              <div className="area-form-row">
                <label>
                  Type the shop name to confirm deletion:
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
                  placeholder="Enter shop name"
                  required
                  autoComplete="off"
                />
              </div>

              {error && (
                <div className="area-shops-error">{error}</div>
              )}

              <div className="area-modal-actions">
                <button
                  type="button"
                  className="area-cancel"
                  onClick={closeDeleteModal}
                  disabled={deleting}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="area-delete-confirm-btn"
                  disabled={deleting}
                >
                  {deleting
                    ? "Deleting..."
                    : "Delete Permanently"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
