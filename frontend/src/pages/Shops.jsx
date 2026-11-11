
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
  Wifi,
  WifiOff,
} from "lucide-react";

import { apiRequest } from "../services/api";
import db from "../database/localDb";
import {
  getLocalAreas,
  saveLocalAreas,
  getLocalShops,
  saveLocalShops,
  getPendingSyncCount,
} from "../services/offlineStorage";

import "./Shops.css";

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

function createId() {
  return crypto.randomUUID();
}

export default function Shops() {
  const [shops, setShops] = useState([]);
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [areaFilter, setAreaFilter] = useState("ALL");

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingShop, setEditingShop] = useState(null);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);

  const [form, setForm] = useState(emptyForm);

  async function refreshPendingCount() {
    const count = await getPendingSyncCount();
    setPendingCount(count);
  }

  function activeAreas(list) {
    return list.filter((area) => area.is_active !== false);
  }

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      if (navigator.onLine) {
        try {
          const [shopResponse, areaResponse] = await Promise.all([
            apiRequest("/shops"),
            apiRequest("/areas"),
          ]);

          const serverShops = shopResponse.shops || [];
          const serverAreas = areaResponse.areas || [];

          await saveLocalAreas(serverAreas);
          await saveLocalShops(serverShops);

          setShops(serverShops.filter((shop) => shop.is_active !== false));
          setAreas(activeAreas(serverAreas));

          await refreshPendingCount();
          return;
        } catch (err) {
          if (navigator.onLine) {
            throw err;
          }
        }
      }

      const [localShops, localAreas] = await Promise.all([
        getLocalShops(),
        getLocalAreas(),
      ]);

      setShops(localShops.filter((shop) => shop.is_active !== false));
      setAreas(activeAreas(localAreas));

      await refreshPendingCount();
    } catch (err) {
      setError(err.message || "Failed to load shop information.");

      try {
        const [localShops, localAreas] = await Promise.all([
          getLocalShops(),
          getLocalAreas(),
        ]);

        if (localShops.length || localAreas.length) {
          setShops(
            localShops.filter((shop) => shop.is_active !== false)
          );
          setAreas(activeAreas(localAreas));
        }
      } catch (localError) {
        console.error("Local shop loading error:", localError);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();

    function handleOnline() {
      setOnline(true);
      loadData();
    }

    function handleOffline() {
      setOnline(false);
      loadData();
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  function openAddForm() {
    setEditingId(null);
    setEditingShop(null);

    setForm({
      ...emptyForm,
      area_id: areas[0]?.id?.toString() || "",
    });

    setError("");
    setShowForm(true);
  }

  function openEditForm(shop) {
    setEditingId(shop.id);
    setEditingShop(shop);

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

  async function saveShopOffline(payload, area) {
    const now = new Date().toISOString();

    if (editingShop) {
      const updatedShop = {
        ...editingShop,
        ...payload,
        area_id: payload.area_id,
        area_name: area?.name || editingShop.area_name || "",
        area_client_id: area?.client_id || null,
        updated_at: now,
        synced: false,
      };

      await db.transaction(
        "rw",
        db.shops,
        db.syncQueue,
        async () => {
          await db.shops.put(updatedShop);

          if (!editingShop.server_id) {
            const pendingCreate = await db.syncQueue
              .where("entity")
              .equals("shop")
              .filter(
                (item) =>
                  item.action === "create" &&
                  item.payload.client_id === editingShop.client_id &&
                  item.status === "pending"
              )
              .first();

            if (pendingCreate) {
              await db.syncQueue.update(pendingCreate.queueId, {
                payload: updatedShop,
              });
              return;
            }
          }

          await db.syncQueue.add({
            operation_id: createId(),
            entity: "shop",
            action: "update",
            status: "pending",
            created_at: now,
            payload: {
              ...updatedShop,
              server_id: editingShop.server_id ?? null,
            },
          });
        }
      );

      return updatedShop;
    }

    const clientId = createId();

    const newShop = {
      ...payload,
      id: `local-${clientId}`,
      client_id: clientId,
      server_id: null,
      area_name: area?.name || "",
      area_client_id: area?.client_id || null,
      is_active: true,
      synced: false,
      created_at: now,
      updated_at: now,
    };

    await db.transaction(
      "rw",
      db.shops,
      db.syncQueue,
      async () => {
        await db.shops.put(newShop);

        await db.syncQueue.add({
          operation_id: createId(),
          entity: "shop",
          action: "create",
          status: "pending",
          created_at: now,
          payload: newShop,
        });
      }
    );

    return newShop;
  }

  async function handleSubmit(e) {
    e.preventDefault();

    setError("");

    if (!form.shop_name.trim()) {
      setError("Shop name is required.");
      return;
    }

    if (!form.area_id) {
      setError("Please select an area.");
      return;
    }

    const numericBalance = Number(form.opening_balance);

    if (!Number.isFinite(numericBalance) || numericBalance < 0) {
      setError("Please enter a valid opening balance.");
      return;
    }

    const selectedArea = getAreaForShop(form.area_id);

    if (!selectedArea) {
      setError("Selected area was not found.");
      return;
    }

    const payload = {
      area_id: selectedArea.server_id || selectedArea.id,
      shop_name: form.shop_name.trim(),
      owner_name: form.owner_name.trim(),
      phone: form.phone.trim(),
      whatsapp_number: form.whatsapp_number.trim(),
      address: form.address.trim(),
      notes: form.notes.trim(),
      opening_balance: numericBalance,
    };

    try {
      setSaving(true);

      const needsLocalSave =
        !navigator.onLine ||
        (editingShop && !editingShop.server_id);

      if (needsLocalSave) {
        await saveShopOffline(
          {
            ...payload,
            area_id: selectedArea.id,
          },
          selectedArea
        );

        setNotice(
          navigator.onLine
            ? "Shop saved locally. It will synchronize when ready."
            : "Shop saved offline. It will synchronize when internet returns."
        );
      } else if (editingId) {
        const response = await apiRequest(`/shops/${editingId}`, {
          method: "PUT",
          body: JSON.stringify({
            ...payload,
            client_id: editingShop?.client_id || undefined,
          }),
        });

        if (response.shop) {
          await db.shops.put({
            ...response.shop,
            server_id: response.shop.id,
            synced: true,
          });
        }

        setNotice("Shop updated successfully.");
      } else {
        const clientId = createId();

        const response = await apiRequest("/shops", {
          method: "POST",
          body: JSON.stringify({
            ...payload,
            client_id: clientId,
          }),
        });

        if (response.shop) {
          await db.shops.put({
            ...response.shop,
            server_id: response.shop.id,
            client_id: response.shop.client_id || clientId,
            synced: true,
          });
        }

        setNotice("Shop registered successfully.");
      }

      setShowForm(false);
      setForm(emptyForm);
      setEditingId(null);
      setEditingShop(null);

      await refreshPendingCount();
      await loadData();
    } catch (err) {
      setError(err.message || "Failed to save shop.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate(shop) {
    const confirmed = window.confirm(
      `Are you sure you want to deactivate ${shop.shop_name}?`
    );

    if (!confirmed) return;

    try {
      if (!navigator.onLine || !shop.server_id) {
        const now = new Date().toISOString();

        await db.transaction(
          "rw",
          db.shops,
          db.syncQueue,
          async () => {
            await db.shops.put({
              ...shop,
              is_active: false,
              synced: false,
              updated_at: now,
            });

            if (!shop.server_id) {
              const pendingCreate = await db.syncQueue
                .where("entity")
                .equals("shop")
                .filter(
                  (item) =>
                    item.action === "create" &&
                    item.payload.client_id === shop.client_id &&
                    item.status === "pending"
                )
                .first();

              if (pendingCreate) {
                await db.syncQueue.delete(pendingCreate.queueId);

                await db.shops.delete(shop.id);
                return;
              }
            }

            await db.syncQueue.add({
              operation_id: createId(),
              entity: "shop",
              action: "deactivate",
              status: "pending",
              created_at: now,
              payload: {
                ...shop,
                server_id: shop.server_id ?? null,
                is_active: false,
              },
            });
          }
        );

        setNotice("Shop deactivated locally.");
      } else {
        await apiRequest(`/shops/${shop.server_id}/deactivate`, {
          method: "PATCH",
        });

        await db.shops.put({
          ...shop,
          is_active: false,
          synced: true,
        });

        setNotice("Shop deactivated successfully.");
      }

      await refreshPendingCount();
      await loadData();
    } catch (err) {
      setError(err.message || "Failed to deactivate shop.");
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
    const searchText = search.toLowerCase();

    const matchesSearch =
      shop.shop_name?.toLowerCase().includes(searchText) ||
      shop.owner_name?.toLowerCase().includes(searchText) ||
      shop.phone?.toLowerCase().includes(searchText) ||
      shop.area_name?.toLowerCase().includes(searchText);

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

      <div className="shops-sync-status">
        {online ? <Wifi size={17} /> : <WifiOff size={17} />}

        <span>{online ? "Online" : "Offline — Local Database"}</span>

        {pendingCount > 0 && (
          <span className="shops-pending">
            {pendingCount} pending changes
          </span>
        )}

        <button onClick={loadData} title="Refresh">
          <RefreshCw size={16} />
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
            <h2>{new Set(shops.map((shop) => shop.area_id)).size}</h2>
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

      {error && <div className="shops-error">{error}</div>}

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
                        {shop.area_name ||
                          getAreaForShop(shop.area_id)?.name ||
                          "—"}
                      </span>
                    </td>

                    <td>{shop.owner_name || "—"}</td>
                    <td>{shop.phone || "—"}</td>

                    <td className="shop-balance">
                      Rs.{" "}
                      {Number(shop.opening_balance || 0).toLocaleString("en-PK")}
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
                          onClick={() => handleDeactivate(shop)}
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
    </div>
  );
}
