
const pool = require("../config/database");
const crypto = require("crypto");

function getPakistanDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function getYesterday() {
  const today = getPakistanDate();
  const date = new Date(`${today}T00:00:00Z`);

  date.setUTCDate(date.getUTCDate() - 1);

  return date.toISOString().slice(0, 10);
}

function verifySecret(req) {
  const expectedSecret = process.env.DAILY_REPORT_SECRET;
  const authorization = req.headers.authorization || "";
  const receivedSecret = authorization.startsWith("Bearer ")
    ? authorization.slice(7)
    : "";

  if (!expectedSecret || !receivedSecret) {
    return false;
  }

  const expected = Buffer.from(expectedSecret);
  const received = Buffer.from(receivedSecret);

  return (
    expected.length === received.length &&
    crypto.timingSafeEqual(expected, received)
  );
}

function formatAmount(value) {
  return Number(value || 0).toLocaleString("en-PK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

async function sendDailyReport(req, res) {
  try {
    if (!verifySecret(req)) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized request.",
      });
    }

    const apiKey = process.env.RESEND_API_KEY;
    const recipient = process.env.REPORT_EMAIL;

    if (!apiKey || !recipient) {
      throw new Error("RESEND_API_KEY or REPORT_EMAIL is missing.");
    }

    const reportDate = getYesterday();

    // Check whether this report was already sent.
    const existingReport = await pool.query(
      `SELECT report_date
       FROM daily_report_logs
       WHERE report_date = $1`,
      [reportDate]
    );

    if (existingReport.rows.length > 0) {
      return res.json({
        success: true,
        message: `Report for ${reportDate} was already sent.`,
      });
    }

    // Yesterday's deliveries and sales.
    const deliveriesResult = await pool.query(
      `SELECT
         COUNT(*) AS delivery_count,
         COALESCE(SUM(total_amount), 0) AS total_sales,
         COUNT(DISTINCT shop_id) AS shops_served
       FROM deliveries
       WHERE (delivery_date AT TIME ZONE 'Asia/Karachi')::date = $1::date`,
      [reportDate]
    );

    // Yesterday's payments.
    const paymentsResult = await pool.query(
      `SELECT
         COUNT(*) AS payment_count,
         COALESCE(SUM(amount), 0) AS total_payments
       FROM payments
       WHERE (payment_date AT TIME ZONE 'Asia/Karachi')::date = $1::date`,
      [reportDate]
    );

    // Yesterday's balance adjustments.
    const adjustmentsResult = await pool.query(
      `SELECT
         COALESCE(SUM(amount) FILTER (
           WHERE adjustment_type = 'ADD'
         ), 0) AS total_added,

         COALESCE(SUM(amount) FILTER (
           WHERE adjustment_type = 'SUBTRACT'
         ), 0) AS total_subtracted

       FROM balance_adjustments
       WHERE (adjustment_date AT TIME ZONE 'Asia/Karachi')::date = $1::date`,
      [reportDate]
    );

    // All-time current unpaid balance.
    const unpaidResult = await pool.query(
      `SELECT
        (
          COALESCE((SELECT SUM(total_amount) FROM deliveries), 0)
          -
          COALESCE((SELECT SUM(amount) FROM payments), 0)
          +
          COALESCE((
            SELECT SUM(amount)
            FROM balance_adjustments
            WHERE adjustment_type = 'ADD'
          ), 0)
          -
          COALESCE((
            SELECT SUM(amount)
            FROM balance_adjustments
            WHERE adjustment_type = 'SUBTRACT'
          ), 0)
        ) AS current_unpaid`
    );

    const deliveries = deliveriesResult.rows[0];
    const payments = paymentsResult.rows[0];
    const adjustments = adjustmentsResult.rows[0];

    const sales = Number(deliveries.total_sales || 0);
    const received = Number(payments.total_payments || 0);
    const added = Number(adjustments.total_added || 0);
    const subtracted = Number(adjustments.total_subtracted || 0);
    const currentUnpaid = Number(
      unpaidResult.rows[0].current_unpaid || 0
    );

    const dailyNetChange = sales - received + added - subtracted;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
      </head>
      <body style="font-family:Arial,sans-serif;background:#f4f6fb;padding:20px;color:#20243a;">
        <div style="max-width:650px;margin:auto;background:white;border-radius:12px;overflow:hidden;">
          
          <div style="background:#2563eb;color:white;padding:25px;text-align:center;">
            <h1 style="margin:0;">Miss Noori</h1>
            <p style="margin:8px 0 0;">Daily Business Report</p>
          </div>

          <div style="padding:25px;">
            <h2>Report Date: ${reportDate}</h2>

            <table style="width:100%;border-collapse:collapse;">
              <tr>
                <td style="padding:12px;border-bottom:1px solid #eee;">Total Deliveries</td>
                <td style="padding:12px;border-bottom:1px solid #eee;text-align:right;">
                  <b>${deliveries.delivery_count}</b>
                </td>
              </tr>

              <tr>
                <td style="padding:12px;border-bottom:1px solid #eee;">Shops Served</td>
                <td style="padding:12px;border-bottom:1px solid #eee;text-align:right;">
                  <b>${deliveries.shops_served}</b>
                </td>
              </tr>

              <tr>
                <td style="padding:12px;border-bottom:1px solid #eee;">Total Sales</td>
                <td style="padding:12px;border-bottom:1px solid #eee;text-align:right;">
                  <b>Rs. ${formatAmount(sales)}</b>
                </td>
              </tr>

              <tr>
                <td style="padding:12px;border-bottom:1px solid #eee;">Payments Received</td>
                <td style="padding:12px;border-bottom:1px solid #eee;text-align:right;">
                  <b>Rs. ${formatAmount(received)}</b>
                </td>
              </tr>

              <tr>
                <td style="padding:12px;border-bottom:1px solid #eee;">Payment Transactions</td>
                <td style="padding:12px;border-bottom:1px solid #eee;text-align:right;">
                  <b>${payments.payment_count}</b>
                </td>
              </tr>

              <tr>
                <td style="padding:12px;border-bottom:1px solid #eee;">Balance Added</td>
                <td style="padding:12px;border-bottom:1px solid #eee;text-align:right;">
                  <b>Rs. ${formatAmount(added)}</b>
                </td>
              </tr>

              <tr>
                <td style="padding:12px;border-bottom:1px solid #eee;">Balance Subtracted</td>
                <td style="padding:12px;border-bottom:1px solid #eee;text-align:right;">
                  <b>Rs. ${formatAmount(subtracted)}</b>
                </td>
              </tr>

              <tr>
                <td style="padding:12px;border-bottom:1px solid #eee;">Daily Net Unpaid Change</td>
                <td style="padding:12px;border-bottom:1px solid #eee;text-align:right;">
                  <b>Rs. ${formatAmount(dailyNetChange)}</b>
                </td>
              </tr>
            </table>

            <div style="background:#eff6ff;padding:18px;border-radius:8px;margin-top:22px;">
              <p style="margin:0;color:#475569;">Current Total Unpaid Balance</p>
              <h2 style="margin:8px 0 0;color:#2563eb;">
                Rs. ${formatAmount(currentUnpaid)}
              </h2>
            </div>

            <p style="color:#64748b;font-size:12px;margin-top:25px;">
              Automatically generated by Miss Noori Cosmetics Management Software.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Send email through Resend HTTP API.
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Miss Noori Software <onboarding@resend.dev>",
        to: [recipient],
        subject: `Miss Noori Daily Report - ${reportDate}`,
        html,
      }),
      signal: AbortSignal.timeout(30000),
    });

    const emailData = await emailResponse.json();

    if (!emailResponse.ok) {
      console.error("[RESEND ERROR]", emailData);

      throw new Error(
        emailData.message || "Resend could not send the email."
      );
    }

    // Save report log only after successful email delivery request.
    await pool.query(
      `INSERT INTO daily_report_logs (report_date)
       VALUES ($1)
       ON CONFLICT (report_date) DO NOTHING`,
      [reportDate]
    );

    console.log(`[DAILY REPORT] Email accepted by Resend for ${reportDate}`);

    return res.json({
      success: true,
      message: "Daily report email sent successfully.",
      report_date: reportDate,
      email_id: emailData.id,
    });

  } catch (error) {
    console.error("[DAILY REPORT ERROR]", error);

    return res.status(500).json({
      success: false,
      message: "Failed to send daily report.",
      error: error.message,
    });
  }
}

module.exports = { sendDailyReport };
