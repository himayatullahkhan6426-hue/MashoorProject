
const pool = require("../config/database");
const nodemailer = require("nodemailer");
const crypto = require("crypto");

function getPakistanDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value])
  );

  return `${values.year}-${values.month}-${values.day}`;
}

function getYesterday() {
  const today = getPakistanDate();
  const date = new Date(`${today}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString("en-PK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function verifySecret(req) {
  const expected = process.env.DAILY_REPORT_SECRET;
  const received = req.headers.authorization || "";

  if (!expected || !received.startsWith("Bearer ")) {
    return false;
  }

  const token = received.slice(7);

  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(token);

  return (
    expectedBuffer.length === receivedBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
  );
}

async function sendDailyReport(req, res) {
  try {
    // Protect this endpoint with a private token.
    if (!verifySecret(req)) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized.",
      });
    }

    const email = process.env.GMAIL_USER;
    const appPassword = process.env.GMAIL_APP_PASSWORD;
    const receiver = process.env.REPORT_EMAIL;

    if (!email || !appPassword || !receiver) {
      throw new Error("Email environment variables are missing.");
    }

    const reportDate = getYesterday();

    // Prevent sending the same report twice.
    const existingReport = await pool.query(
      `SELECT report_date
       FROM daily_report_logs
       WHERE report_date = $1`,
      [reportDate]
    );

    if (existingReport.rows.length > 0) {
      return res.json({
        success: true,
        message: `Report for ${reportDate} has already been sent.`,
      });
    }

    // Fetch daily business figures.
    const [
      deliveriesResult,
      paymentsResult,
      adjustmentsResult,
      unpaidResult,
    ] = await Promise.all([
      pool.query(
        `SELECT
           COUNT(*)::int AS total_deliveries,
           COALESCE(SUM(total_amount), 0) AS total_sales,
           COUNT(DISTINCT shop_id)::int AS shops_served
         FROM deliveries
         WHERE (delivery_date AT TIME ZONE 'Asia/Karachi')::date = $1::date`,
        [reportDate]
      ),

      pool.query(
        `SELECT
           COUNT(*)::int AS total_payments,
           COALESCE(SUM(amount), 0) AS total_received
         FROM payments
         WHERE (payment_date AT TIME ZONE 'Asia/Karachi')::date = $1::date`,
        [reportDate]
      ),

      pool.query(
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
      ),

      pool.query(
        `SELECT
           COALESCE((SELECT SUM(total_amount) FROM deliveries), 0)
           - COALESCE((SELECT SUM(amount) FROM payments), 0)
           + COALESCE((
               SELECT SUM(amount)
               FROM balance_adjustments
               WHERE adjustment_type = 'ADD'
             ), 0)
           - COALESCE((
               SELECT SUM(amount)
               FROM balance_adjustments
               WHERE adjustment_type = 'SUBTRACT'
             ), 0) AS total_unpaid`
      ),
    ]);

    const deliveries = deliveriesResult.rows[0];
    const payments = paymentsResult.rows[0];
    const adjustments = adjustmentsResult.rows[0];
    const totalUnpaid = unpaidResult.rows[0].total_unpaid;

    const sales = Number(deliveries.total_sales);
    const received = Number(payments.total_received);
    const added = Number(adjustments.total_added);
    const subtracted = Number(adjustments.total_subtracted);

    const dailyUnpaidChange =
      sales - received + added - subtracted;

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: email,
        pass: appPassword.replace(/\s/g, ""),
      },
    });

    const subject = `Miss Noori Daily Report - ${reportDate}`;

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:650px;margin:auto;color:#20243a">
        <div style="background:#2457d6;color:white;padding:22px;border-radius:10px 10px 0 0">
          <h2 style="margin:0">Miss Noori Daily Business Report</h2>
          <p style="margin:8px 0 0">Report Date: ${reportDate}</p>
        </div>

        <div style="padding:22px;border:1px solid #e5e7eb;border-radius:0 0 10px 10px">
          <h3>Daily Activity</h3>
          <table style="width:100%;border-collapse:collapse">
            <tr><td style="padding:10px;border-bottom:1px solid #eee">Total Deliveries</td><td style="padding:10px;text-align:right"><b>${deliveries.total_deliveries}</b></td></tr>
            <tr><td style="padding:10px;border-bottom:1px solid #eee">Total Sales</td><td style="padding:10px;text-align:right"><b>Rs. ${formatMoney(sales)}</b></td></tr>
            <tr><td style="padding:10px;border-bottom:1px solid #eee">Payments Received</td><td style="padding:10px;text-align:right"><b>Rs. ${formatMoney(received)}</b></td></tr>
            <tr><td style="padding:10px;border-bottom:1px solid #eee">Payment Transactions</td><td style="padding:10px;text-align:right"><b>${payments.total_payments}</b></td></tr>
            <tr><td style="padding:10px;border-bottom:1px solid #eee">Shops Served</td><td style="padding:10px;text-align:right"><b>${deliveries.shops_served}</b></td></tr>
            <tr><td style="padding:10px;border-bottom:1px solid #eee">Balance Added</td><td style="padding:10px;text-align:right"><b>Rs. ${formatMoney(added)}</b></td></tr>
            <tr><td style="padding:10px;border-bottom:1px solid #eee">Balance Subtracted</td><td style="padding:10px;text-align:right"><b>Rs. ${formatMoney(subtracted)}</b></td></tr>
          </table>

          <h3 style="margin-top:25px">Account Summary</h3>
          <p>Daily net change in unpaid: <b>Rs. ${formatMoney(dailyUnpaidChange)}</b></p>
          <p>Total current unpaid balance: <b>Rs. ${formatMoney(totalUnpaid)}</b></p>

          <p style="margin-top:25px;color:#777;font-size:12px">
            Automatically generated by Miss Noori Management Software.
          </p>
        </div>
      </div>
    `;

    await transporter.sendMail({
      from: `"Miss Noori Software" <${email}>`,
      to: receiver,
      subject,
      html,
    });

    await pool.query(
      `INSERT INTO daily_report_logs (report_date)
       VALUES ($1)
       ON CONFLICT (report_date) DO NOTHING`,
      [reportDate]
    );

    console.log(`[DAILY REPORT] Email sent for ${reportDate}.`);

    return res.json({
      success: true,
      message: `Daily report for ${reportDate} sent successfully.`,
    });
  } catch (error) {
    console.error("[DAILY REPORT ERROR]", error);

    return res.status(500).json({
      success: false,
      message: "Daily report could not be sent.",
    });
  }
}

module.exports = { sendDailyReport };
