
const pool = require("../config/database");

async function getDashboard(req, res) {
  try {
    const [
      financialResult,
      shopsResult,
      areasResult,
      todayResult,
      deliveriesResult,
      paymentsResult,
    ] = await Promise.all([

      // Overall financial summary
      pool.query(`
        SELECT
          COALESCE((
            SELECT SUM(opening_balance)
            FROM shops
            WHERE is_active = TRUE
          ), 0) AS opening_balance,

          COALESCE((
            SELECT SUM(amount)
            FROM balance_adjustments
            WHERE adjustment_type = 'ADD'
          ), 0) AS total_added,

          COALESCE((
            SELECT SUM(amount)
            FROM balance_adjustments
            WHERE adjustment_type = 'SUBTRACT'
          ), 0) AS total_subtracted
      `),

      // Total active shops
      pool.query(`
        SELECT COUNT(*) AS total_shops
        FROM shops
        WHERE is_active = TRUE
      `),

      // Total active areas
      pool.query(`
        SELECT COUNT(*) AS total_areas
        FROM areas
        WHERE is_active = TRUE
      `),

      // Today's deliveries (display only)
      pool.query(`
        SELECT
          COUNT(*) AS today_deliveries,
          COALESCE(SUM(total_amount), 0) AS today_sales
        FROM deliveries
        WHERE delivery_date >= CURRENT_DATE
          AND delivery_date < CURRENT_DATE + INTERVAL '1 day'
      `),

      // Recent deliveries (display only)
      pool.query(`
        SELECT
          d.id,
          d.invoice_number,
          d.delivery_date,
          d.subtotal,
          d.discount,
          d.total_amount,
          s.shop_name
        FROM deliveries d
        INNER JOIN shops s ON s.id = d.shop_id
        ORDER BY d.delivery_date DESC, d.id DESC
        LIMIT 8
      `),

      // Recent payments (display only)
      pool.query(`
        SELECT
          p.id,
          p.amount,
          p.payment_date,
          p.payment_method,
          p.reference_number,
          s.shop_name
        FROM payments p
        INNER JOIN shops s ON s.id = p.shop_id
        ORDER BY p.payment_date DESC, p.id DESC
        LIMIT 8
      `),
    ]);

    const financial = financialResult.rows[0];

    const openingBalance = Number(financial.opening_balance);
    const totalAdded = Number(financial.total_added);
    const totalSubtracted = Number(financial.total_subtracted);

    const totalUnpaid =
      openingBalance + totalAdded - totalSubtracted;

    return res.json({
      success: true,

      stats: {
        total_sales: 0,
        total_received: 0,
        total_unpaid: totalUnpaid,
        total_shops: Number(shopsResult.rows[0].total_shops),
        total_areas: Number(areasResult.rows[0].total_areas),
        today_deliveries: 0,
        today_sales: 0,
      },

      recent_deliveries: deliveriesResult.rows,
      recent_payments: paymentsResult.rows,
    });

  } catch (error) {
    console.error("Dashboard error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to load dashboard data.",
    });
  }
}

module.exports = { getDashboard };
