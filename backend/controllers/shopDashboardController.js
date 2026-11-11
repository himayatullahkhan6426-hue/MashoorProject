const pool = require("../config/database");

async function getShopDashboard(req, res) {
  try {
    const { id } = req.params;

    const [
      shopResult,
      deliveriesResult,
      paymentsResult,
      adjustmentsResult,
    ] = await Promise.all([

      // Shop details and account summary
      pool.query(
        `
          SELECT
            s.*,
            a.name AS area_name,

            COALESCE(d.total_sales, 0) AS total_sales,
            COALESCE(d.delivery_count, 0) AS delivery_count,

            COALESCE(p.total_payments, 0) AS total_payments,
            COALESCE(p.payment_count, 0) AS payment_count,

            COALESCE(ba.total_added, 0) AS total_balance_added,
            COALESCE(ba.total_subtracted, 0) AS total_balance_subtracted,

            (
              COALESCE(s.opening_balance, 0)
              + COALESCE(ba.total_added, 0)
              - COALESCE(ba.total_subtracted, 0)
            ) AS unpaid_balance

          FROM shops s

          LEFT JOIN areas a ON a.id = s.area_id

          LEFT JOIN (
            SELECT
              shop_id,
              SUM(total_amount) AS total_sales,
              COUNT(*) AS delivery_count
            FROM deliveries
            WHERE shop_id = $1
            GROUP BY shop_id
          ) d ON d.shop_id = s.id

          LEFT JOIN (
            SELECT
              shop_id,
              SUM(amount) AS total_payments,
              COUNT(*) AS payment_count
            FROM payments
            WHERE shop_id = $1
            GROUP BY shop_id
          ) p ON p.shop_id = s.id

          LEFT JOIN (
            SELECT
              shop_id,
              SUM(CASE WHEN adjustment_type = 'ADD' THEN amount ELSE 0 END) AS total_added,
              SUM(CASE WHEN adjustment_type = 'SUBTRACT' THEN amount ELSE 0 END) AS total_subtracted
            FROM balance_adjustments
            WHERE shop_id = $1
            GROUP BY shop_id
          ) ba ON ba.shop_id = s.id

          WHERE s.id = $1
        `,
        [id]
      ),

      // Delivery history
      pool.query(
        `
          SELECT
            d.id,
            d.invoice_number,
            d.delivery_date,
            d.subtotal,
            d.discount,
            d.total_amount,

            COALESCE(
              json_agg(
                json_build_object(
                  'product_name', di.product_name,
                  'quantity', di.quantity,
                  'unit_price', di.unit_price,
                  'line_total', di.line_total
                )
              ) FILTER (WHERE di.id IS NOT NULL),
              '[]'
            ) AS items

          FROM deliveries d
          LEFT JOIN delivery_items di ON di.delivery_id = d.id

          WHERE d.shop_id = $1

          GROUP BY d.id
          ORDER BY d.delivery_date DESC
        `,
        [id]
      ),

      // Payment history
      pool.query(
        `
          SELECT *
          FROM payments
          WHERE shop_id = $1
          ORDER BY payment_date DESC
        `,
        [id]
      ),

      // Manual adjustment history
      pool.query(
        `
          SELECT *
          FROM balance_adjustments
          WHERE shop_id = $1
          ORDER BY adjustment_date DESC, id DESC
        `,
        [id]
      ),
    ]);

    if (shopResult.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Shop not found.",
      });
    }

    return res.json({
      success: true,
      shop: shopResult.rows[0],
      deliveries: deliveriesResult.rows,
      payments: paymentsResult.rows,
      adjustments: adjustmentsResult.rows,
    });

  } catch (error) {
    console.error("Shop dashboard error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to load shop dashboard.",
    });
  }
}

module.exports = { getShopDashboard };