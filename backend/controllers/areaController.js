
const pool = require("../config/database");

// GET ALL AREAS
exports.getAreas = async (req, res) => {
  try {
    const { search, type, status } = req.query;

    let query = `
      SELECT
        id,
        name,
        area_type,
        district,
        description,
        is_active,
        created_at
      FROM areas
      WHERE 1 = 1
    `;

    const values = [];

    const searchTerm =
      typeof search === "string" ? search.trim() : "";

    if (searchTerm) {
      values.push(`%${searchTerm}%`);

      query += `
        AND (
          name ILIKE $${values.length}
          OR district ILIKE $${values.length}
        )
      `;
    }

    if (type && ["VILLAGE", "TOWN"].includes(type)) {
      values.push(type);
      query += ` AND area_type = $${values.length}`;
    }

    if (status === "inactive") {
      query += " AND is_active = FALSE";
    } else if (status !== "all") {
      query += " AND is_active = TRUE";
    }

    query += " ORDER BY name ASC";

    const result = await pool.query(query, values);

    return res.json({
      success: true,
      areas: result.rows,
    });
  } catch (error) {
    console.error("Get areas error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve areas.",
    });
  }
};

// CREATE AREA
exports.createArea = async (req, res) => {
  try {
    const { name, area_type, district, description } = req.body;

    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Area name is required.",
      });
    }

    if (!["VILLAGE", "TOWN"].includes(area_type)) {
      return res.status(400).json({
        success: false,
        message: "Select a valid area type.",
      });
    }

    const result = await pool.query(
      `
        INSERT INTO areas (
          name,
          area_type,
          district,
          description
        )
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `,
      [
        name.trim(),
        area_type,
        typeof district === "string" ? district.trim() || null : null,
        typeof description === "string"
          ? description.trim() || null
          : null,
      ]
    );

    return res.status(201).json({
      success: true,
      message: "Area created successfully.",
      area: result.rows[0],
    });
  } catch (error) {
    console.error("Create area error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to create area.",
    });
  }
};

// UPDATE AREA
exports.updateArea = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, area_type, district, description } = req.body;

    if (typeof name !== "string" || !name.trim()) {
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
          AND is_active = TRUE
        RETURNING *
      `,
      [
        name.trim(),
        area_type,
        typeof district === "string" ? district.trim() || null : null,
        typeof description === "string"
          ? description.trim() || null
          : null,
        id,
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Active area not found.",
      });
    }

    return res.json({
      success: true,
      message: "Area updated successfully.",
      area: result.rows[0],
    });
  } catch (error) {
    console.error("Update area error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to update area.",
    });
  }
};

// DEACTIVATE AREA
exports.deactivateArea = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
        UPDATE areas
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
        message: "Active area not found.",
      });
    }

    return res.json({
      success: true,
      message: "Area deactivated successfully.",
    });
  } catch (error) {
    console.error("Deactivate area error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to deactivate area.",
    });
  }
};
