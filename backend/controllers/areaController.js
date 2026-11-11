
const pool = require("../config/database");
const { randomUUID } = require("crypto");

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function getAreas(req, res) {
  try {
    const { search, type, status } = req.query;

    const values = [];
    const conditions = [];

    if (search) {
      values.push(`%${search}%`);
      conditions.push(
        `(name ILIKE $${values.length} OR district ILIKE $${values.length})`
      );
    }

    if (type) {
      values.push(type);
      conditions.push(`area_type = $${values.length}`);
    }

    if (status === "active") {
      conditions.push("is_active = TRUE");
    } else if (status === "inactive") {
      conditions.push("is_active = FALSE");
    }

    const where = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    const result = await pool.query(
      `SELECT * FROM areas ${where} ORDER BY name ASC`,
      values
    );

    res.json({
      success: true,
      areas: result.rows,
    });
  } catch (error) {
    console.error("Get areas error:", error.message);
    res.status(500).json({
      success: false,
      message: "Unable to load areas.",
    });
  }
}

async function createArea(req, res) {
  try {
    const {
      name,
      area_type,
      district,
      description,
      client_id,
    } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Area name is required.",
      });
    }

    if (!["VILLAGE", "TOWN"].includes(area_type)) {
      return res.status(400).json({
        success: false,
        message: "Invalid area type.",
      });
    }

    if (client_id && !UUID_REGEX.test(client_id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid client ID.",
      });
    }

    const result = await pool.query(
      `
        INSERT INTO areas (
          name,
          area_type,
          district,
          description,
          client_id,
          is_active
        )
        VALUES ($1, $2, $3, $4, $5, TRUE)
        ON CONFLICT (client_id) DO NOTHING
        RETURNING *
      `,
      [
        name.trim(),
        area_type,
        district?.trim() || null,
        description?.trim() || null,
        client_id || null,
      ]
    );

    if (result.rows.length) {
      return res.status(201).json({
        success: true,
        area: result.rows[0],
      });
    }

    if (client_id) {
      const existing = await pool.query(
        "SELECT * FROM areas WHERE client_id = $1",
        [client_id]
      );

      if (existing.rows.length) {
        return res.status(200).json({
          success: true,
          area: existing.rows[0],
          already_synced: true,
        });
      }
    }

    return res.status(409).json({
      success: false,
      message: "Unable to create area.",
    });
  } catch (error) {
    console.error("Create area error:", error.message);
    res.status(500).json({
      success: false,
      message: "Unable to create area.",
    });
  }
}

async function updateArea(req, res) {
  try {
    const { id } = req.params;
    const { name, area_type, district, description } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Area name is required.",
      });
    }

    if (!["VILLAGE", "TOWN"].includes(area_type)) {
      return res.status(400).json({
        success: false,
        message: "Invalid area type.",
      });
    }

    const result = await pool.query(
      `
        UPDATE areas
        SET
          name = $1,
          area_type = $2,
          district = $3,
          description = $4,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $5
        RETURNING *
      `,
      [
        name.trim(),
        area_type,
        district?.trim() || null,
        description?.trim() || null,
        id,
      ]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        success: false,
        message: "Area not found.",
      });
    }

    res.json({
      success: true,
      area: result.rows[0],
    });
  } catch (error) {
    console.error("Update area error:", error.message);
    res.status(500).json({
      success: false,
      message: "Unable to update area.",
    });
  }
}

async function deactivateArea(req, res) {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
        UPDATE areas
        SET is_active = FALSE,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *
      `,
      [id]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        success: false,
        message: "Area not found.",
      });
    }

    res.json({
      success: true,
      area: result.rows[0],
    });
  } catch (error) {
    console.error("Deactivate area error:", error.message);
    res.status(500).json({
      success: false,
      message: "Unable to deactivate area.",
    });
  }
}

module.exports = {
  getAreas,
  createArea,
  updateArea,
  deactivateArea,
};
