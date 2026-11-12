
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
  AlertTriangle,
  LockKeyhole,
} from "lucide-react";

import db from "../database/localDb";
import {
  getLocalShops,
  createLocalShop,
  updateLocalShop,
} from "../services/localShopStorage";
import { verifyDevicePassword } from "../services/localAuth";

import "./Shops.css";

const emptyForm = {
  area_id: "",
  shop_name: "",
  owner_name: "",
  phone: "",
  whatsapp_number: "",
  address: "",
  notes: "",
  unpaid_balance: "0",
};

export default function Shops() {
  const [shops, setShops] = useState([]);
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [areaFilter, setAreaFilter] = useState("ALL");

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState(emptyForm);

  const [deleteShop, setDeleteShop] = useState(null);
  const [deletePassword, setDeletePassword] = useState("");
  const [deletePhrase, setDeletePhrase] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const [localShops, localAreas] = await Promise.all([
        getLocalShops(),
        db.areas.toArray(),
      ]);

      setShops(
        localShops.filter((shop) => shop.is_active !== false)
      );

      setAreas(
        localAreas.filter((area) => area.is_active !== false)
      );
    } catch (err) {
      console.error("Local shops loading error:", err);
      setError(err.message || "Failed to load shop information.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function openAddForm() {
    setEditingId(null);

    setForm({
      ...emptyForm,
      area_id: areas[0]?.id?.toString() || "",
    });

    setError("");
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
      unpaid_balance: String(shop.unpaid_balance ?? 0),
    });

    setError("");
    setShowForm(true);
  }

  function handleChange(e) {
    const { name, value } = e.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  function getAreaForShop(areaId) {
    return areas.find(
      (area) => String(area.id) === String(areaId)
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();

    setError("");
    setNotice("");

    if (!form.shop_name.trim()) {
      setError("Shop name is required.");
      return;
    }

    if (!form.area_id) {
      setError("Please select an area.");
      return;
    }

    const numericBalance = Number(form.unpaid_balance);

    if (!Number.isFinite(numericBalance) || numericBalance < 0) {
      setError("Please enter a valid Unpaid amount.");
      return;
    }

    const selectedArea = getAreaForShop(form.area_id);

    if (!selectedArea) {
      setError("Selected area was not found.");
      return;
    }

    const payload = {
      ...form,
      area_id: selectedArea.id,
      shop_name: form.shop_name.trim(),
      owner_name: form.owner_name.trim(),
      phone: form.phone.trim(),
      whatsapp_number: form.whatsapp_number.trim(),
      address: form.address.trim(),
      notes: form.notes.trim(),
      unpaid_balance: numericBalance,
    };

    try {
      setSaving(true);

      if (editingId) {
        await updateLocalShop(editingId, payload);
        setNotice("Shop updated successfully.");
      } else {
        await createLocalShop(payload);
        setNotice("Shop registered successfully.");
      }

      setShowForm(false);
      setForm(emptyForm);
      setEditingId(null);

      await loadData();
    } catch (err) {
      console.error("Shop save error:", err);
      setError(err.message || "Failed to save shop.");
    } finally {
      setSaving(false);
    }
  }

  function openDeleteModal(shop) {
    setDeleteShop(shop);
    setDeletePassword("");
    setDeletePhrase("");
    setDeleteError("");
    setNotice("");
  }

  function closeDeleteModal() {
    if (deleting) return;

    setDeleteShop(null);
    setDeletePassword("");
    setDeletePhrase("");
    setDeleteError("");
  }

  // Confirmation now requires only the exact shop name.
  const expectedPhrase = deleteShop
    ? deleteShop.shop_name
    : "";

  async function handleDelete(e) {
    e.preventDefault();

    if (!deleteShop) {
      setDeleteError("No shop selected.");
      return;
    }

    if (!deletePassword) {
      setDeleteError("Please enter your device password.");
      return;
    }

    if (deletePhrase !== expectedPhrase) {
      setDeleteError("Shop name does not match.");
      return;
    }

    try {
      setDeleting(true);
      setDeleteError("");

      const isPasswordValid =
        await verifyDevicePassword(deletePassword);

      if (!isPasswordValid) {
        setDeleteError("Incorrect device password.");
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

      const deletedShopName = deleteShop.shop_name;

      setDeleteShop(null);
      setDeletePassword("");
      setDeletePhrase("");
      setNotice(`${deletedShopName} permanently deleted.`);
      setError("");

      await loadData();
    } catch (err) {
      console.error("Permanent shop deletion error:", err);
      setDeleteError(err.message || "Failed to delete shop.");
    } finally {
      setDeleting(false);
    }
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

  const filteredShops = shops.filter((shop) => {
    const searchText = search.toLowerCase().trim();

    const matchesSearch =
      shop.shop_name?.toLowerCase().includes(searchText) ||
      shop.owner_name?.toLowerCase().includes(searchText) ||
      shop.phone?.toLowerCase().includes(searchText) ||
      shop.area_name?.toLowerCase().includes(searchText) ||
      shop.address?.toLowerCase().includes(searchText);

    const matchesArea =
      areaFilter === "ALL" ||
      String(shop.area_id) === areaFilter ||
      String(shop.area_client_id) === areaFilter;

    return matchesSearch && matchesArea;
  });

  return (
    <div className="shops-page">
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
              {
                new Set(
                  shops.map((shop) => String(shop.area_id))
                ).size
              }
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

      {notice && (
        <div className="shops-notice">
          {notice}
          <button onClick={() => setNotice("")}>
            <X size={16} />
          </button>
        </div>
      )}

      <div className="shops-toolbar">
        <div className="shops-search">
          <Search size={19} />
          <input
            type="search"
            id="shops-search-filter"
            name="shops-search-filter"
            placeholder="Search shop, owner, phone or area..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
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
          disabled={loading}
        >
          <RefreshCw size={18} />
        </button>
      </div>

      {error && <div className="shops-error">{error}</div>}

      <div className="shops-table-container">
        <table className="shops-table">
          <thead>
            <tr>
              <th>Shop Information</th>
              <th>Village / Town</th>
              <th>Owner</th>
              <th>Phone</th>
              <th>Unpaid</th>
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
                        {shop.area_name ||
                          getAreaForShop(shop.area_id)?.name ||
                          "—"}
                      </span>
                    </td>

                    <td>{shop.owner_name || "—"}</td>
                    <td>{shop.phone || "—"}</td>

                    <td className="shop-balance">
                      Rs.{" "}
                      {Number(
                        shop.unpaid_balance || 0
                      ).toLocaleString("en-PK")}
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
                          onClick={() => openDeleteModal(shop)}
                          title="Permanently delete shop"
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

              <button
                type="button"
                onClick={() => {
                  if (saving) return;
                  setShowForm(false);
                  setError("");
                }}
              >
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

              <label>Unpaid (Rs.)</label>
              <input
                type="number"
                name="unpaid_balance"
                min="0"
                step="0.01"
                value={form.unpaid_balance}
                onChange={handleChange}
                placeholder="Enter unpaid amount"
              />

              <label>Additional Notes</label>
              <textarea
                name="notes"
                rows="3"
                value={form.notes}
                onChange={handleChange}
                placeholder="Optional information..."
              />

              {error && <div className="shops-error">{error}</div>}

              <div className="shop-modal-actions">
                <button
                  type="button"
                  className="shop-cancel-btn"
                  onClick={() => {
                    if (saving) return;
                    setShowForm(false);
                    setError("");
                  }}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="shop-save-btn"
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

      {deleteShop && (
        <div className="shop-modal-overlay">
          <div className="shop-modal shop-delete-modal">
            <div className="shop-modal-header">
              <div>
                <h2>Delete Shop Permanently</h2>
                <p>
                  This action cannot be undone. The selected shop
                  and its adjustment history will be permanently deleted.
                </p>
              </div>

              <button
                type="button"
                onClick={closeDeleteModal}
              >
                <X size={21} />
              </button>
            </div>

            <div className="shop-delete-warning">
              <AlertTriangle size={21} />
              <div>
                <strong>{deleteShop.shop_name}</strong>
                <p>
                  Its unpaid record and related adjustment history
                  will also be deleted. Other shops will remain safe.
                </p>
              </div>
            </div>

            <form onSubmit={handleDelete}>
              <label>
                <LockKeyhole size={15} />
                Device Password
              </label>

              <input
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                placeholder="Enter your device password"
                autoComplete="new-password"
                required
              />

              <label>
                Type the shop name to confirm deletion:
              </label>

              <div className="shop-delete-phrase">
                {expectedPhrase}
              </div>

              <input
                type="text"
                value={deletePhrase}
                onChange={(e) => setDeletePhrase(e.target.value)}
                placeholder="Enter shop name"
                autoComplete="off"
                required
              />

              {deleteError && (
                <div className="shops-error">{deleteError}</div>
              )}

              <div className="shop-modal-actions">
                <button
                  type="button"
                  className="shop-cancel-btn"
                  onClick={closeDeleteModal}
                  disabled={deleting}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="shop-delete-confirm-btn"
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
