
const pool = require("../config/database");

async function globalSearch(req, res) {
  try {
    const searchText = String(req.query.q || "").trim();

    if (searchText.length < 2) {
      return res.json({ success: true, results: [] });
    }

    const pattern = `%${searchText}%`;

    const [shops, areas, products] = await Promise.all([
      // Search shops
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

      // Search areas
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

      // Search products
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
    ]);

    const results = [
      ...shops.rows.map((item) => ({
        ...item,
        type: "shop",
      })),

      ...areas.rows.map((item) => ({
        ...item,
        type: "area",
      })),

      ...products.rows.map((item) => ({
        ...item,
        type: "product",
      })),
    ];

    return res.json({
      success: true,
      results,
    });

  } catch (error) {
    console.error("Global search error:", error);

    return res.status(500).json({
      success: false,
      message: "Search failed. Please try again.",
    });
  }
}

module.exports = { globalSearch };
