const pool = require("../config/database");

async function createPayment(req, res) {
  try {
    const { id } = req.params;

    const {
      amount,
      payment_date,
      payment_method,
      reference_number,
      notes,
    } = req.body;

    const numericAmount = Number(amount);

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Payment amount must be greater than zero.",
      });
    }

    const shopResult = await pool.query(
      "SELECT id FROM shops WHERE id = $1 AND is_active = true",
      [id]
    );

    if (shopResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Shop not found.",
      });
    }

    const result = await pool.query(
      `
        INSERT INTO payments (
          shop_id,
          amount,
          payment_date,
          payment_method,
          reference_number,
          notes
        )
        VALUES (
          $1,
          $2,
          COALESCE($3::timestamptz, CURRENT_TIMESTAMP),
          $4,
          $5,
          $6
        )
        RETURNING *
      `,
      [
        id,
        numericAmount,
        payment_date || null,
        payment_method || null,
        reference_number || null,
        notes || null,
      ]
    );

    return res.status(201).json({
      success: true,
      message: "Payment recorded successfully.",
      payment: result.rows[0],
    });

  } catch (error) {
    console.error("Payment error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to record payment.",
    });
  }
}

module.exports = {
  createPayment,
};