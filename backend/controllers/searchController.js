
const pool = require("../config/database");

async function globalSearch(req, res) {
  try {
    const searchText = String(req.query.q || "").trim();

    if (searchText.length < 2) {
      return res.json({ success: true, results: [] });
    }

    const pattern = `%${searchText}%`;

    const [shops, areas, products, deliveries, payments] =
      await Promise.all([
        pool.query(
          `SELECT id, shop_name AS title,
                  CONCAT_WS(' • ', owner_name, phone) AS description
           FROM shops
           WHERE shop_name ILIKE $1
              OR COALESCE(owner_name, '') ILIKE $1
              OR COALESCE(phone, '') ILIKE $1
              OR COALESCE(whatsapp_number, '') ILIKE $1
           ORDER BY shop_name
           LIMIT 5`,
          [pattern]
        ),

        pool.query(
          `SELECT id, name AS title,
                  CONCAT_WS(' • ', area_type, district) AS description
           FROM areas
           WHERE name ILIKE $1
              OR COALESCE(district, '') ILIKE $1
              OR COALESCE(area_type, '') ILIKE $1
           ORDER BY name
           LIMIT 5`,
          [pattern]
        ),

        pool.query(
          `SELECT id, product_name AS title,
                  CONCAT_WS(' • ', category, 'Stock: ' || stock_quantity) AS description
           FROM products
           WHERE product_name ILIKE $1
              OR COALESCE(category, '') ILIKE $1
           ORDER BY product_name
           LIMIT 5`,
          [pattern]
        ),

        pool.query(
          `SELECT d.id, d.shop_id,
                  d.invoice_number AS title,
                  CONCAT_WS(' • ', s.shop_name, 'Rs. ' || d.total_amount::text) AS description
           FROM deliveries d
           JOIN shops s ON s.id = d.shop_id
           WHERE d.invoice_number ILIKE $1
              OR s.shop_name ILIKE $1
              OR COALESCE(d.notes, '') ILIKE $1
           ORDER BY d.delivery_date DESC
           LIMIT 5`,
          [pattern]
        ),

        pool.query(
          `SELECT p.id, p.shop_id,
                  'Payment - Rs. ' || p.amount::text AS title,
                  CONCAT_WS(' • ', s.shop_name, p.payment_method,
                            p.reference_number, p.notes) AS description
           FROM payments p
           JOIN shops s ON s.id = p.shop_id
           WHERE COALESCE(p.reference_number, '') ILIKE $1
              OR COALESCE(p.payment_method, '') ILIKE $1
              OR COALESCE(p.notes, '') ILIKE $1
              OR p.amount::text ILIKE $1
              OR s.shop_name ILIKE $1
           ORDER BY p.payment_date DESC
           LIMIT 5`,
          [pattern]
        ),
      ]);

    const results = [
      ...shops.rows.map((item) => ({ ...item, type: "shop" })),
      ...areas.rows.map((item) => ({ ...item, type: "area" })),
      ...products.rows.map((item) => ({ ...item, type: "product" })),
      ...deliveries.rows.map((item) => ({ ...item, type: "delivery" })),
      ...payments.rows.map((item) => ({ ...item, type: "payment" })),
    ];

    res.json({ success: true, results });
  } catch (error) {
    console.error("Global search error:", error);

    res.status(500).json({
      success: false,
      message: "Search failed. Please try again.",
    });
  }
}

module.exports = { globalSearch };
