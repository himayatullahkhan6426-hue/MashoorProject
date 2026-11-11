
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
      INNER JOIN areas a ON a.id = s.area_id
      WHERE 1 = 1
    `;

    const values = [];

    const searchTerm =
      typeof search === "string" ? search.trim() : "";

    if (searchTerm) {
      values.push(`%${searchTerm}%`);

      query += `
        AND (
          s.shop_name ILIKE $${values.length}
          OR s.owner_name ILIKE $${values.length}
          OR s.phone ILIKE $${values.length}
        )
      `;
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

    return res.json({
      success: true,
      shops: result.rows,
    });
  } catch (error) {
    console.error("Get shops error:", error.message);

    return res.status(500).json({
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
      client_id,
    } = req.body;

    if (
      !area_id ||
      typeof shop_name !== "string" ||
      !shop_name.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Area and shop name are required.",
      });
    }

    // Validate optional client UUID.
    if (
      client_id &&
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        client_id
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid client ID.",
      });
    }

    const balance = Number(opening_balance ?? 0);

    if (!Number.isFinite(balance) || balance < 0) {
      return res.status(400).json({
        success: false,
        message:
          "Opening balance must be a valid non-negative amount.",
      });
    }

    // Create shop. If this client_id already exists,
    // do not create another shop.
    const result = await pool.query(
      `
        INSERT INTO shops (
          area_id,
          shop_name,
          owner_name,
          phone,
          whatsapp_number,
          address,
          notes,
          opening_balance,
          client_id
        )
        SELECT
          a.id,
          $2, $3, $4, $5, $6, $7, $8, $9
        FROM areas a
        WHERE a.id = $1
          AND a.is_active = TRUE
        ON CONFLICT (client_id) DO NOTHING
        RETURNING *
      `,
      [
        area_id,
        shop_name.trim(),
        owner_name?.trim() || null,
        phone?.trim() || null,
        whatsapp_number?.trim() || null,
        address?.trim() || null,
        notes?.trim() || null,
        balance,
        client_id || null,
      ]
    );

    // New shop successfully created.
    if (result.rowCount > 0) {
      return res.status(201).json({
        success: true,
        message: "Shop created successfully.",
        shop: result.rows[0],
      });
    }

    // If client_id already exists, return the original shop.
    // This makes repeated offline sync requests safe.
    if (client_id) {
      const existingShop = await pool.query(
        `
          SELECT *
          FROM shops
          WHERE client_id = $1
          LIMIT 1
        `,
        [client_id]
      );

      if (existingShop.rowCount > 0) {
        return res.status(200).json({
          success: true,
          message: "Shop was already synchronized.",
          shop: existingShop.rows[0],
        });
      }
    }

    return res.status(400).json({
      success: false,
      message: "Selected village or town is not active.",
    });
  } catch (error) {
    console.error("Create shop error:", error.message);

    return res.status(500).json({
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

    if (
      !area_id ||
      typeof shop_name !== "string" ||
      !shop_name.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Area and shop name are required.",
      });
    }

    const balance = Number(opening_balance ?? 0);

    if (!Number.isFinite(balance) || balance < 0) {
      return res.status(400).json({
        success: false,
        message:
          "Opening balance must be a valid non-negative amount.",
      });
    }

    const result = await pool.query(
      `
        UPDATE shops
        SET
          area_id = $1,
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
            SELECT 1
            FROM areas
            WHERE areas.id = $1
              AND areas.is_active = TRUE
          )
        RETURNING *
      `,
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

    return res.json({
      success: true,
      message: "Shop updated successfully.",
      shop: result.rows[0],
    });
  } catch (error) {
    console.error("Update shop error:", error.message);

    return res.status(500).json({
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
      `
        UPDATE shops
        SET
          is_active = FALSE,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
          AND is_active = TRUE
        RETURNING id
      `,
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Active shop not found.",
      });
    }

    return res.json({
      success: true,
      message: "Shop deactivated successfully.",
    });
  } catch (error) {
    console.error("Deactivate shop error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to deactivate shop.",
    });
  }
};
