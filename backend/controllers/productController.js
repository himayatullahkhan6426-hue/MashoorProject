const pool = require("../config/database");

// Get all products
async function getProducts(req, res) {
  try {
    const { search = "", status = "active" } = req.query;

    let query = `
      SELECT *
      FROM products
      WHERE 1=1
    `;

    const values = [];

    if (status !== "all") {
      values.push(status === "inactive");
      query += ` AND is_active = $${values.length}`;
    }

    if (search.trim()) {
      values.push(`%${search.trim()}%`);
      query += ` AND (
        product_name ILIKE $${values.length}
        OR category ILIKE $${values.length}
      )`;
    }

    query += " ORDER BY product_name ASC";

    const result = await pool.query(query, values);

    res.json({
      success: true,
      products: result.rows,
    });
  } catch (error) {
    console.error("Get products error:", error);
    res.status(500).json({
      success: false,
      message: "Unable to fetch products.",
    });
  }
}

// Create product
async function createProduct(req, res) {
  try {
    const {
      product_name,
      category,
      purchase_price,
      selling_price,
      stock_quantity,
      low_stock_threshold,
    } = req.body;

    if (!product_name?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Product name is required.",
      });
    }

    const purchasePrice = Number(purchase_price ?? 0);
    const sellingPrice = Number(selling_price ?? 0);
    const stock = Number(stock_quantity ?? 0);
    const threshold = Number(low_stock_threshold ?? 5);

    if (
      ![purchasePrice, sellingPrice, stock, threshold].every(Number.isFinite) ||
      purchasePrice < 0 ||
      sellingPrice < 0 ||
      !Number.isInteger(stock) ||
      stock < 0 ||
      !Number.isInteger(threshold) ||
      threshold < 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Please enter valid prices and stock quantities.",
      });
    }

    const result = await pool.query(
      `INSERT INTO products
       (product_name, category, purchase_price, selling_price,
        stock_quantity, low_stock_threshold)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        product_name.trim(),
        category?.trim() || null,
        purchasePrice,
        sellingPrice,
        stock,
        threshold,
      ]
    );

    res.status(201).json({
      success: true,
      message: "Product created successfully.",
      product: result.rows[0],
    });
  } catch (error) {
    console.error("Create product error:", error);
    res.status(500).json({
      success: false,
      message: "Unable to create product.",
    });
  }
}

// Update product
async function updateProduct(req, res) {
  try {
    const { id } = req.params;

    const {
      product_name,
      category,
      purchase_price,
      selling_price,
      low_stock_threshold,
    } = req.body;

    if (!product_name?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Product name is required.",
      });
    }

    const purchasePrice = Number(purchase_price);
    const sellingPrice = Number(selling_price);
    const threshold = Number(low_stock_threshold);

    if (
      ![purchasePrice, sellingPrice, threshold].every(Number.isFinite) ||
      purchasePrice < 0 ||
      sellingPrice < 0 ||
      !Number.isInteger(threshold) ||
      threshold < 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid product information.",
      });
    }

    const result = await pool.query(
      `UPDATE products
       SET product_name = $1,
           category = $2,
           purchase_price = $3,
           selling_price = $4,
           low_stock_threshold = $5,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $6 AND is_active = TRUE
       RETURNING *`,
      [
        product_name.trim(),
        category?.trim() || null,
        purchasePrice,
        sellingPrice,
        threshold,
        id,
      ]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        success: false,
        message: "Product not found.",
      });
    }

    res.json({
      success: true,
      message: "Product updated successfully.",
      product: result.rows[0],
    });
  } catch (error) {
    console.error("Update product error:", error);
    res.status(500).json({
      success: false,
      message: "Unable to update product.",
    });
  }
}

// Deactivate product
async function deactivateProduct(req, res) {
  try {
    const result = await pool.query(
      `UPDATE products
       SET is_active = FALSE,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND is_active = TRUE
       RETURNING id`,
      [req.params.id]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        success: false,
        message: "Product not found.",
      });
    }

    res.json({
      success: true,
      message: "Product deactivated successfully.",
    });
  } catch (error) {
    console.error("Deactivate product error:", error);
    res.status(500).json({
      success: false,
      message: "Unable to deactivate product.",
    });
  }
}

module.exports = {
  getProducts,
  createProduct,
  updateProduct,
  deactivateProduct,
};