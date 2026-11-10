import { useEffect, useState } from "react";
import {
  Plus, Search, Package, Pencil, Trash2,
  X, RefreshCw, AlertTriangle
} from "lucide-react";

import { apiRequest } from "../services/api";
import "./Products.css";

const emptyForm = {
  product_name: "",
  category: "",
  purchase_price: "",
  selling_price: "",
  stock_quantity: "",
  low_stock_threshold: 5,
};

export default function Products() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");

  async function loadProducts() {
    try {
      setLoading(true);
      const response = await apiRequest("/products");
      setProducts(response.products || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProducts();
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

  function openEditForm(product) {
    setEditingId(product.id);
    setForm({
      product_name: product.product_name,
      category: product.category || "",
      purchase_price: product.purchase_price,
      selling_price: product.selling_price,
      stock_quantity: product.stock_quantity,
      low_stock_threshold: product.low_stock_threshold,
    });
    setError("");
    setShowForm(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    try {
      const payload = {
        ...form,
        purchase_price: Number(form.purchase_price),
        selling_price: Number(form.selling_price),
        stock_quantity: Number(form.stock_quantity),
        low_stock_threshold: Number(form.low_stock_threshold),
      };

      if (editingId) {
        await apiRequest(`/products/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        await apiRequest("/products", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }

      setShowForm(false);
      setForm(emptyForm);
      setEditingId(null);
      await loadProducts();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDeactivate(id) {
    if (!window.confirm("Are you sure you want to deactivate this product?")) {
      return;
    }

    try {
      await apiRequest(`/products/${id}/deactivate`, {
        method: "PATCH",
      });
      await loadProducts();
    } catch (err) {
      setError(err.message);
    }
  }

  const filteredProducts = products.filter((product) =>
    `${product.product_name} ${product.category || ""}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const lowStock = products.filter(
    (product) =>
      Number(product.stock_quantity) <=
      Number(product.low_stock_threshold)
  );

  const totalStock = products.reduce(
    (total, product) => total + Number(product.stock_quantity),
    0
  );

  return (
    <div className="products-page">

      <div className="products-heading">
        <div>
          <h1>Products</h1>
          <p>Manage your cosmetics products and inventory.</p>
        </div>

        <button className="product-add-btn" onClick={openAddForm}>
          <Plus size={19} /> Add Product
        </button>
      </div>

      <div className="product-stats">
        <div className="product-stat-card">
          <Package />
          <div>
            <span>Total Products</span>
            <h2>{products.length}</h2>
          </div>
        </div>

        <div className="product-stat-card">
          <RefreshCw />
          <div>
            <span>Total Stock Units</span>
            <h2>{totalStock}</h2>
          </div>
        </div>

        <div className="product-stat-card warning">
          <AlertTriangle />
          <div>
            <span>Low Stock Products</span>
            <h2>{lowStock.length}</h2>
          </div>
        </div>
      </div>

      {error && <div className="product-error">{error}</div>}

      <div className="products-toolbar">
        <div className="products-search">
          <Search size={19} />
          <input
            placeholder="Search product or category..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <button className="refresh-btn" onClick={loadProducts}>
          <RefreshCw size={17} /> Refresh
        </button>
      </div>

      <div className="products-table-card">
        <div className="products-table-heading">
          <h3>Product Inventory</h3>
          <span>{filteredProducts.length} products</span>
        </div>

        {loading ? (
          <p className="products-message">Loading products...</p>
        ) : filteredProducts.length === 0 ? (
          <p className="products-message">No products found. Add your first product.</p>
        ) : (
          <div className="products-table-wrapper">
            <table className="products-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Purchase Price</th>
                  <th>Selling Price</th>
                  <th>Stock</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredProducts.map((product) => {
                  const isLow =
                    Number(product.stock_quantity) <=
                    Number(product.low_stock_threshold);

                  return (
                    <tr key={product.id}>
                      <td>
                        <strong>{product.product_name}</strong>
                      </td>
                      <td>{product.category || "—"}</td>
                      <td>Rs. {Number(product.purchase_price).toLocaleString()}</td>
                      <td>Rs. {Number(product.selling_price).toLocaleString()}</td>
                      <td>
                        <strong>{product.stock_quantity}</strong>
                      </td>
                      <td>
                        <span className={isLow ? "stock-low" : "stock-good"}>
                          {isLow ? "Low Stock" : "In Stock"}
                        </span>
                      </td>
                      <td>
                        <div className="product-actions">
                          <button
                            title="Edit"
                            onClick={() => openEditForm(product)}
                          >
                            <Pencil size={17} />
                          </button>

                          <button
                            className="delete-product"
                            title="Deactivate"
                            onClick={() => handleDeactivate(product.id)}
                          >
                            <Trash2 size={17} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <div className="product-modal-overlay">
          <div className="product-modal">
            <div className="product-modal-header">
              <div>
                <h2>{editingId ? "Edit Product" : "Add New Product"}</h2>
                <p>Enter the product information below.</p>
              </div>

              <button
                className="modal-close"
                onClick={() => setShowForm(false)}
              >
                <X />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="product-form-grid">

                <label>
                  Product Name *
                  <input
                    name="product_name"
                    value={form.product_name}
                    onChange={handleChange}
                    placeholder="e.g. Face Cream"
                    required
                  />
                </label>

                <label>
                  Category
                  <input
                    name="category"
                    value={form.category}
                    onChange={handleChange}
                    placeholder="e.g. Skincare"
                  />
                </label>

                <label>
                  Purchase Price (Rs.) *
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    name="purchase_price"
                    value={form.purchase_price}
                    onChange={handleChange}
                    required
                  />
                </label>

                <label>
                  Selling Price (Rs.) *
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    name="selling_price"
                    value={form.selling_price}
                    onChange={handleChange}
                    required
                  />
                </label>

                {!editingId && (
                  <label>
                    Initial Stock *
                    <input
                      type="number"
                      min="0"
                      step="1"
                      name="stock_quantity"
                      value={form.stock_quantity}
                      onChange={handleChange}
                      required
                    />
                  </label>
                )}

                <label>
                  Low Stock Alert Threshold
                  <input
                    type="number"
                    min="0"
                    step="1"
                    name="low_stock_threshold"
                    value={form.low_stock_threshold}
                    onChange={handleChange}
                    required
                  />
                </label>

              </div>

              {editingId && (
                <p className="stock-edit-note">
                  Stock quantity is not editable here. We'll manage stock
                  through inventory adjustments and deliveries.
                </p>
              )}

              {error && <div className="product-error">{error}</div>}

              <div className="product-form-actions">
                <button
                  type="button"
                  className="cancel-product-btn"
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </button>

                <button type="submit" className="product-save-btn">
                  {editingId ? "Update Product" : "Save Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}