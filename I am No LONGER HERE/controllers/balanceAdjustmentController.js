const pool = require("../config/database");
const { randomUUID } = require("crypto");

async function createBalanceAdjustment(req, res) {
  try {
    const { id } = req.params;

    const {
      adjustment_type,
      amount,
      reason,
      adjustment_date,
    } = req.body;

    const operationId = req.body.operation_id || randomUUID();
    const numericAmount = Number(amount);

    if (!["ADD", "SUBTRACT"].includes(adjustment_type)) {
      return res.status(400).json({
        success: false,
        message: "Invalid adjustment type.",
      });
    }

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Amount must be greater than zero.",
      });
    }

    if (!reason || !reason.trim()) {
      return res.status(400).json({
        success: false,
        message: "Please provide a reason.",
      });
    }

    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(operationId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid operation ID.",
      });
    }

    const result = await pool.query(
      `
        INSERT INTO balance_adjustments (
          shop_id,
          adjustment_type,
          amount,
          reason,
          adjustment_date,
          operation_id
        )
        VALUES (
          $1, $2, $3, $4,
          COALESCE($5::timestamptz, CURRENT_TIMESTAMP),
          $6
        )
        ON CONFLICT (operation_id)
        DO NOTHING
        RETURNING *
      `,
      [
        id,
        adjustment_type,
        numericAmount,
        reason.trim(),
        adjustment_date || null,
        operationId,
      ]
    );

    if (result.rows.length > 0) {
      return res.status(201).json({
        success: true,
        message: "Balance adjustment saved successfully.",
        adjustment: result.rows[0],
      });
    }

    const existing = await pool.query(
      `SELECT * FROM balance_adjustments WHERE operation_id = $1`,
      [operationId]
    );

    return res.status(200).json({
      success: true,
      message: "This adjustment was already synchronized.",
      adjustment: existing.rows[0],
      already_synced: true,
    });

  } catch (error) {
    console.error("Balance adjustment error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to save balance adjustment.",
    });
  }
}

module.exports = { createBalanceAdjustment };