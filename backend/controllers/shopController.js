const pool = require("../config/database");

// GET ALL SHOPS
exports.getShops = async (req, res) => {
  try {
    const { search, area_id, status } = req.query;

    let query = `
      SELECT
        s.*,
        a.name AS area_name,
        a.area_type,
        a.district
      FROM shops s
      JOIN areas a ON s.area_id = a.id
      WHERE 1=1
    `;

    const values = [];

    if (search) {
      values.push(`%${search}%`);
      query += ` AND (
        s.shop_name ILIKE $${values.length}
        OR s.owner_name ILIKE $${values.length}
        OR s.phone ILIKE $${values.length}
      )`;
    }

    if (area_id) {
      values.push(area_id);
      query += ` AND s.area_id = $${values.length}`;
    }

    if (status === "inactive") {
      query += " AND s.is_active = FALSE";
    } else if (status !== "all") {
      query += " AND s.is_active = TRUE";
    }

    query += " ORDER BY s.created_at DESC";

    const result = await pool.query(query, values);

    res.json({
      success: true,
      shops: result.rows,
    });
  } catch (error) {
    console.error("Get shops error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve shops.",
    });
  }
};

// CREATE SHOP
exports.createShop = async (req, res) => {
  try {
    const {
      area_id,
      shop_name,
      owner_name,
      phone,
      whatsapp_number,
      address,
      notes,
      opening_balance,
    } = req.body;

    if (!area_id || !shop_name?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Area and shop name are required.",
      });
    }

    const balance = Number(opening_balance ?? 0);

    if (!Number.isFinite(balance) || balance < 0) {
      return res.status(400).json({
        success: false,
        message: "Opening balance must be a valid non-negative amount.",
      });
    }

    const area = await pool.query(
      `SELECT id FROM areas
       WHERE id = $1 AND is_active = TRUE`,
      [area_id]
    );

    if (area.rowCount === 0) {
      return res.status(400).json({
        success: false,
        message: "Selected village or town is not active.",
      });
    }

    const result = await pool.query(
      `INSERT INTO shops (
        area_id,
        shop_name,
        owner_name,
        phone,
        whatsapp_number,
        address,
        notes,
        opening_balance
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING *`,
      [
        area_id,
        shop_name.trim(),
        owner_name?.trim() || null,
        phone?.trim() || null,
        whatsapp_number?.trim() || null,
        address?.trim() || null,
        notes?.trim() || null,
        balance,
      ]
    );

    res.status(201).json({
      success: true,
      message: "Shop created successfully.",
      shop: result.rows[0],
    });
  } catch (error) {
    console.error("Create shop error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create shop.",
    });
  }
};

// UPDATE SHOP
exports.updateShop = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      area_id,
      shop_name,
      owner_name,
      phone,
      whatsapp_number,
      address,
      notes,
      opening_balance,
    } = req.body;

    if (!area_id || !shop_name?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Area and shop name are required.",
      });
    }

    const balance = Number(opening_balance ?? 0);

    if (!Number.isFinite(balance) || balance < 0) {
      return res.status(400).json({
        success: false,
        message: "Opening balance must be a valid non-negative amount.",
      });
    }

    const result = await pool.query(
      `UPDATE shops
       SET area_id = $1,
           shop_name = $2,
           owner_name = $3,
           phone = $4,
           whatsapp_number = $5,
           address = $6,
           notes = $7,
           opening_balance = $8,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $9
         AND is_active = TRUE
         AND EXISTS (
           SELECT 1 FROM areas
           WHERE areas.id = $1 AND areas.is_active = TRUE
         )
       RETURNING *`,
      [
        area_id,
        shop_name.trim(),
        owner_name?.trim() || null,
        phone?.trim() || null,
        whatsapp_number?.trim() || null,
        address?.trim() || null,
        notes?.trim() || null,
        balance,
        id,
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Active shop or selected area not found.",
      });
    }

    res.json({
      success: true,
      message: "Shop updated successfully.",
      shop: result.rows[0],
    });
  } catch (error) {
    console.error("Update shop error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update shop.",
    });
  }
};

// DEACTIVATE SHOP
exports.deactivateShop = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE shops
       SET is_active = FALSE,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND is_active = TRUE
       RETURNING id`,
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Active shop not found.",
      });
    }

    res.json({
      success: true,
      message: "Shop deactivated successfully.",
    });
  } catch (error) {
    console.error("Deactivate shop error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to deactivate shop.",
    });
  }
};