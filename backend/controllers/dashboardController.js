
const pool = require("../config/database");

async function getDashboard(req, res) {
  try {
    const [
      financialResult,
      shopsResult,
      areasResult,
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
        total_unpaid: totalUnpaid,
        total_shops: Number(shopsResult.rows[0].total_shops),
        total_areas: Number(areasResult.rows[0].total_areas),
      },
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
