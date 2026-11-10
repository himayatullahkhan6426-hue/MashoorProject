const pool = require("../config/database");

async function createBalanceAdjustment(req, res) {
  try {
    const { id } = req.params;
    const {
      adjustment_type,
      amount,
      reason,
      adjustment_date,
    } = req.body;

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

    const result = await pool.query(
      `
        INSERT INTO balance_adjustments (
          shop_id,
          adjustment_type,
          amount,
          reason,
          adjustment_date
        )
        VALUES ($1, $2, $3, $4, COALESCE($5::timestamptz, CURRENT_TIMESTAMP))
        RETURNING *
      `,
      [
        id,
        adjustment_type,
        numericAmount,
        reason.trim(),
        adjustment_date || null,
      ]
    );

    return res.status(201).json({
      success: true,
      message: "Balance adjustment saved successfully.",
      adjustment: result.rows[0],
    });

  } catch (error) {
    console.error("Balance adjustment error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to save balance adjustment.",
    });
  }
}

module.exports = {
  createBalanceAdjustment,
};