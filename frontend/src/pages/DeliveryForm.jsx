
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Package,
  Save,
  LoaderCircle,
} from "lucide-react";

import { apiRequest } from "../services/api";
import "./DeliveryForm.css";

function DeliveryForm() {
  const { shopId } = useParams();
  const navigate = useNavigate();

  const [products, setProducts] = useState([]);
  const [shop, setShop] = useState(null);
  const [items, setItems] = useState([]);
  const [discount, setDiscount] = useState("0");
  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadData();
  }, [shopId]);

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const [productData, shopData] = await Promise.all([
        apiRequest("/deliveries/products"),
        apiRequest(`/shops/${shopId}/dashboard`),
      ]);

      setProducts(productData.products || []);
      setShop(shopData.shop);
    } catch (err) {
      setError(err.message || "Unable to load delivery information.");
    } finally {
      setLoading(false);
    }
  }

  const subtotal = useMemo(() => {
    return items.reduce((sum, item) => {
      return sum + Number(item.quantity) * Number(item.unit_price);
    }, 0);
  }, [items]);

  const total = Math.max(0, subtotal - Number(discount || 0));

  function addProduct() {
    setItems([
      ...items,
      {
        product_id: "",
        quantity: 1,
      },
    ]);
  }

  function updateItem(index, field, value) {
    setItems((previous) =>
      previous.map((item, itemIndex) =>
        itemIndex === index
          ? { ...item, [field]: value }
          : item
      )
    );
  }

  function removeItem(index) {
    setItems((previous) =>
      previous.filter((_, itemIndex) => itemIndex !== index)
    );
  }

  function getProduct(productId) {
    return products.find(
      (product) => String(product.id) === String(productId)
    );
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");

    if (items.length === 0) {
      setError("Please add at least one product.");
      return;
    }

    if (items.some((item) => !item.product_id || Number(item.quantity) <= 0)) {
      setError("Please select products and enter valid quantities.");
      return;
    }

    if (Number(discount) < 0 || Number(discount) > subtotal) {
      setError("Invalid discount amount.");
      return;
    }

    try {
      setSaving(true);

      const response = await apiRequest(`/deliveries/shops/${shopId}`, {
        method: "POST",
        body: JSON.stringify({
          items: items.map((item) => ({
            product_id: Number(item.product_id),
            quantity: Number(item.quantity),
          })),
          discount: Number(discount),
          notes,
        }),
      });

      alert(response.message || "Delivery created successfully.");

      navigate(`/shops/${shopId}`);
    } catch (err) {
      setError(err.message || "Unable to save delivery.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="delivery-loading">
        <LoaderCircle className="delivery-spinner" size={28} />
        <p>Loading delivery form...</p>
      </div>
    );
  }

  return (
    <div className="delivery-form-page">
      <div className="delivery-page-header">
        <button
          type="button"
          className="delivery-back-button"
          onClick={() => navigate(`/shops/${shopId}`)}
        >
          <ArrowLeft size={18} />
          Back to Shop
        </button>

        <div>
          <h1>New Delivery</h1>
          <p>Create a new product delivery for this shop.</p>
        </div>
      </div>

      {shop && (
        <div className="delivery-shop-card">
          <Package size={22} />
          <div>
            <span>Delivering to</span>
            <strong>{shop.shop_name}</strong>
          </div>
        </div>
      )}

      {error && (
        <div className="delivery-error">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="delivery-section">
          <div className="delivery-section-header">
            <div>
              <h2>Delivery Products</h2>
              <p>Select products and enter their quantities.</p>
            </div>

            <button
              type="button"
              className="delivery-add-button"
              onClick={addProduct}
            >
              <Plus size={17} />
              Add Product
            </button>
          </div>

          {items.length === 0 ? (
            <div className="delivery-empty">
              <Package size={35} />
              <p>No products added yet.</p>
              <button type="button" onClick={addProduct}>
                Add your first product
              </button>
            </div>
          ) : (
            <div className="delivery-items-list">
              {items.map((item, index) => {
                const product = getProduct(item.product_id);

                return (
                  <div className="delivery-item-row" key={index}>
                    <div className="delivery-field delivery-product-field">
                      <label>Product</label>

                      <select
                        value={item.product_id}
                        required
                        onChange={(event) =>
                          updateItem(
                            index,
                            "product_id",
                            event.target.value
                          )
                        }
                      >
                        <option value="">Select product</option>

                        {products.map((product) => (
                          <option
                            key={product.id}
                            value={product.id}
                            disabled={
                              Number(product.stock_quantity) <= 0 ||
                              items.some(
                                (other, otherIndex) =>
                                  otherIndex !== index &&
                                  String(other.product_id) === String(product.id)
                              )
                            }
                          >
                            {product.product_name} — Stock: {product.stock_quantity}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="delivery-field">
                      <label>Quantity</label>
                      <input
                        type="number"
                        min="1"
                        max={product?.stock_quantity || undefined}
                        value={item.quantity}
                        required
                        onChange={(event) =>
                          updateItem(index, "quantity", event.target.value)
                        }
                      />
                    </div>

                    <div className="delivery-field">
                      <label>Unit Price</label>
                      <div className="delivery-readonly-price">
                        Rs. {product
                          ? Number(product.selling_price).toLocaleString()
                          : "0"}
                      </div>
                    </div>

                    <div className="delivery-field">
                      <label>Line Total</label>
                      <div className="delivery-line-total">
                        Rs. {product
                          ? (
                              Number(item.quantity || 0) *
                              Number(product.selling_price)
                            ).toLocaleString()
                          : "0"}
                      </div>
                    </div>

                    <button
                      type="button"
                      className="delivery-remove-button"
                      onClick={() => removeItem(index)}
                      title="Remove product"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="delivery-bottom-grid">
          <div className="delivery-section delivery-notes-section">
            <h2>Additional Notes</h2>
            <textarea
              rows="4"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Optional delivery notes..."
            />
          </div>

          <div className="delivery-section delivery-summary">
            <h2>Delivery Summary</h2>

            <div className="delivery-summary-row">
              <span>Subtotal</span>
              <strong>Rs. {subtotal.toLocaleString()}</strong>
            </div>

            <div className="delivery-summary-row">
              <label htmlFor="delivery-discount">Discount (Rs.)</label>
              <input
                id="delivery-discount"
                type="number"
                min="0"
                max={subtotal}
                step="0.01"
                value={discount}
                onChange={(event) => setDiscount(event.target.value)}
              />
            </div>

            <div className="delivery-summary-total">
              <span>Total Amount</span>
              <strong>Rs. {total.toLocaleString()}</strong>
            </div>

            <button
              type="submit"
              className="delivery-save-button"
              disabled={saving || items.length === 0}
            >
              {saving ? (
                <LoaderCircle className="delivery-spinner" size={19} />
              ) : (
                <Save size={19} />
              )}
              {saving ? "Saving Delivery..." : "Save Delivery"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

export default DeliveryForm;
