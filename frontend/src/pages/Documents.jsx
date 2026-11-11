
import { useRef, useState } from "react";
import {
  FileText,
  Upload,
  Download,
  Share2,
  FileDown,
  FolderOpen,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Printer,
  Trash2,
} from "lucide-react";

import db from "../database/localDb";

import {
  exportLocalBackup,
  downloadBackup,
  restoreLocalBackup,
} from "../services/localBackup";

import "./Documents.css";

const HISTORY_KEY = "miss-noori-generated-documents";

const formatRupees = (value) =>
  `Rs. ${Number(value || 0).toLocaleString("en-PK")}`;

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const getShopBalance = (shop) => {
  const fields = [
    "unpaid_balance",
    "balance",
    "current_balance",
    "remaining_balance",
    "outstanding_balance",
  ];

  for (const field of fields) {
    if (shop[field] !== undefined && shop[field] !== null) {
      return Number(shop[field]) || 0;
    }
  }

  return 0;
};

const getShopOwner = (shop) =>
  shop.owner_name ||
  shop.owner ||
  shop.contact_person ||
  shop.person_name ||
  "—";

const getShopPhone = (shop) =>
  shop.phone ||
  shop.phone_number ||
  shop.mobile ||
  shop.contact ||
  "—";

const getShopAddress = (shop) =>
  shop.address ||
  shop.shop_address ||
  shop.location ||
  "—";

const getShopStatus = (shop) =>
  shop.is_active === false || shop.is_active === 0
    ? "Inactive"
    : "Active";

function readDocumentHistory() {
  try {
    const saved = JSON.parse(
      localStorage.getItem(HISTORY_KEY) || "[]"
    );

    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function saveDocumentHistory(document) {
  try {
    const history = readDocumentHistory();

    const updated = [
      document,
      ...history.filter((item) => item.id !== document.id),
    ].slice(0, 10);

    localStorage.setItem(
      HISTORY_KEY,
      JSON.stringify(updated)
    );

    return updated;
  } catch {
    return readDocumentHistory();
  }
}

function buildReportHtml(data) {
  const { areas, shops, adjustments, generatedAt } = data;

  const sortedAreas = [...areas].sort((a, b) =>
    String(a.name || "").localeCompare(
      String(b.name || "")
    )
  );

  const groupedAreas = sortedAreas.map((area) => ({
    ...area,
    shops: shops
      .filter(
        (shop) => String(shop.area_id) === String(area.id)
      )
      .sort((a, b) =>
        String(a.shop_name || "").localeCompare(
          String(b.shop_name || "")
        )
      ),
  }));

  const unassignedShops = shops
    .filter(
      (shop) =>
        !areas.some(
          (area) => String(area.id) === String(shop.area_id)
        )
    )
    .sort((a, b) =>
      String(a.shop_name || "").localeCompare(
        String(b.shop_name || "")
      )
    );

  const totalUnpaid = shops.reduce(
    (total, shop) => total + getShopBalance(shop),
    0
  );

  const areaSections = groupedAreas
    .map((area) => {
      const areaTotal = area.shops.reduce(
        (total, shop) => total + getShopBalance(shop),
        0
      );

      const rows = area.shops.length
        ? area.shops
            .map(
              (shop, index) => `
                <tr>
                  <td>${index + 1}</td>
                  <td>${escapeHtml(shop.shop_name || "Unnamed Shop")}</td>
                  <td>${escapeHtml(getShopOwner(shop))}</td>
                  <td>${escapeHtml(getShopPhone(shop))}</td>
                  <td>${escapeHtml(getShopAddress(shop))}</td>
                  <td>${formatRupees(getShopBalance(shop))}</td>
                  <td>${getShopStatus(shop)}</td>
                </tr>
              `
            )
            .join("")
        : `<tr><td colspan="7" class="empty">No shops in this area</td></tr>`;

      return `
        <section class="area-section">
          <div class="area-heading">
            <div>
              <h2>${escapeHtml(area.name || "Unnamed Area")}</h2>
              <p>${area.shops.length} shops</p>
            </div>
            <strong>Area Unpaid: ${formatRupees(areaTotal)}</strong>
          </div>

          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Shop Name</th>
                <th>Owner</th>
                <th>Contact</th>
                <th>Address</th>
                <th>Unpaid</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </section>
      `;
    })
    .join("");

  const unassignedSection = unassignedShops.length
    ? `
      <section class="area-section">
        <div class="area-heading">
          <div>
            <h2>Other Shops</h2>
            <p>${unassignedShops.length} shops without a matching area</p>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Shop Name</th>
              <th>Owner</th>
              <th>Contact</th>
              <th>Address</th>
              <th>Unpaid</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${unassignedShops
              .map(
                (shop, index) => `
                  <tr>
                    <td>${index + 1}</td>
                    <td>${escapeHtml(shop.shop_name || "Unnamed Shop")}</td>
                    <td>${escapeHtml(getShopOwner(shop))}</td>
                    <td>${escapeHtml(getShopPhone(shop))}</td>
                    <td>${escapeHtml(getShopAddress(shop))}</td>
                    <td>${formatRupees(getShopBalance(shop))}</td>
                    <td>${getShopStatus(shop)}</td>
                  </tr>
                `
              )
              .join("")}
          </tbody>
        </table>
      </section>
    `
    : "";

  const adjustmentRows = adjustments.length
    ? [...adjustments]
        .sort(
          (a, b) =>
            new Date(b.adjustment_date || 0) -
            new Date(a.adjustment_date || 0)
        )
        .map((item, index) => {
          const shop = shops.find(
            (entry) => String(entry.id) === String(item.shop_id)
          );

          return `
            <tr>
              <td>${index + 1}</td>
              <td>${escapeHtml(shop?.shop_name || "Unknown Shop")}</td>
              <td>${escapeHtml(item.adjustment_type || "—")}</td>
              <td>${escapeHtml(item.description || item.reason || "—")}</td>
              <td>${formatRupees(item.amount || item.adjustment_amount || 0)}</td>
              <td>${escapeHtml(item.adjustment_date || "—")}</td>
            </tr>
          `;
        })
        .join("")
    : `<tr><td colspan="6" class="empty">No adjustment records</td></tr>`;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8" />
      <title>Miss Noori - Complete Business Report</title>
      <style>
        * { box-sizing: border-box; }
        body {
          font-family: Arial, sans-serif;
          color: #1e293b;
          margin: 25px;
          font-size: 11px;
        }
        .report-header {
          border-bottom: 3px solid #2563eb;
          padding-bottom: 15px;
          margin-bottom: 20px;
        }
        h1 {
          color: #1d4ed8;
          font-size: 25px;
          margin: 0 0 6px;
        }
        .report-header p { color: #64748b; margin: 4px 0; }
        .stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          margin-bottom: 25px;
        }
        .stat {
          background: #eff6ff;
          border: 1px solid #dbeafe;
          padding: 13px;
          border-radius: 7px;
        }
        .stat span { display: block; color: #64748b; margin-bottom: 6px; }
        .stat strong { font-size: 17px; color: #1d4ed8; }
        .area-section { margin: 24px 0; page-break-inside: avoid; }
        .area-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: #eff6ff;
          border-left: 4px solid #2563eb;
          padding: 10px 12px;
          margin-bottom: 10px;
        }
        .area-heading h2 { margin: 0; font-size: 16px; color: #1e40af; }
        .area-heading p { margin: 4px 0 0; color: #64748b; }
        .area-heading strong { color: #1e40af; }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 12px;
        }
        th {
          background: #1e40af;
          color: white;
          text-align: left;
          padding: 8px 6px;
        }
        td {
          border: 1px solid #dbe3ef;
          padding: 7px 6px;
          overflow-wrap: anywhere;
        }
        tbody tr:nth-child(even) { background: #f8fafc; }
        .empty { text-align: center; color: #64748b; padding: 15px; }
        .summary {
          margin-top: 25px;
          padding: 13px;
          background: #f1f5f9;
          border-radius: 7px;
        }
        h2.section-title {
          color: #1e40af;
          font-size: 18px;
          margin-top: 30px;
        }
        .footer {
          margin-top: 30px;
          border-top: 1px solid #cbd5e1;
          padding-top: 10px;
          color: #64748b;
          text-align: center;
        }
        @media print {
          body { margin: 12mm; }
          .area-section { page-break-inside: auto; }
          tr { page-break-inside: avoid; }
          thead { display: table-header-group; }
        }
      </style>
    </head>
    <body>
      <header class="report-header">
        <h1>Miss Noori</h1>
        <p>Cosmetics Distribution - Complete Business Report</p>
        <p>Generated: ${escapeHtml(generatedAt)}</p>
      </header>

      <div class="stats">
        <div class="stat">
          <span>Total Areas</span>
          <strong>${areas.length}</strong>
        </div>
        <div class="stat">
          <span>Total Shops</span>
          <strong>${shops.length}</strong>
        </div>
        <div class="stat">
          <span>Total Unpaid</span>
          <strong>${formatRupees(totalUnpaid)}</strong>
        </div>
      </div>

      <h2 class="section-title">Area-wise Shop Records</h2>
      ${areaSections}
      ${unassignedSection}

      <h2 class="section-title">Adjustment History</h2>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Shop</th>
            <th>Type</th>
            <th>Description</th>
            <th>Amount</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>${adjustmentRows}</tbody>
      </table>

      <div class="summary">
        <strong>Overall Summary</strong><br />
        Areas: ${areas.length} |
        Shops: ${shops.length} |
        Adjustments: ${adjustments.length} |
        Total Unpaid: ${formatRupees(totalUnpaid)}
      </div>

      <div class="footer">
        Miss Noori Cosmetics Management Software
      </div>
    </body>
    </html>
  `;
}

export default function Documents() {
  const fileInputRef = useRef(null);

  const [loading, setLoading] = useState("");
  const [message, setMessage] = useState(null);
  const [history, setHistory] = useState(readDocumentHistory);

  const showMessage = (type, text) => {
    setMessage({ type, text });
  };

  const handleExport = async () => {
    try {
      setLoading("export");
      setMessage(null);

      const backup = await exportLocalBackup();

      downloadBackup(backup);

      showMessage(
        "success",
        "Complete database backup downloaded successfully."
      );
    } catch (error) {
      showMessage(
        "error",
        error.message || "Could not export database."
      );
    } finally {
      setLoading("");
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImport = async (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    try {
      setLoading("import");
      setMessage(null);

      if (!file.name.toLowerCase().endsWith(".json")) {
        throw new Error("Please select a valid JSON backup file.");
      }

      const text = await file.text();
      const backup = JSON.parse(text);

      const confirmed = window.confirm(
        "WARNING: Importing this backup will replace ALL current local database data, including areas, shops, adjustments and users.\n\nA backup of current data will be downloaded first.\n\nDo you want to continue?"
      );

      if (!confirmed) return;

      const result = await restoreLocalBackup(backup);

      showMessage(
        "success",
        `Import successful. Restored ${result.restored.length} database tables. Your previous data backup was downloaded.`
      );
    } catch (error) {
      showMessage(
        "error",
        error.message || "Could not import backup."
      );
    } finally {
      setLoading("");
      event.target.value = "";
    }
  };

  const generateReport = async () => {
    const [areas, shops, adjustments] = await Promise.all([
      db.areas.toArray(),
      db.shops.toArray(),
      db.adjustments.toArray(),
    ]);

    const generatedAt = new Date().toLocaleString("en-PK", {
      dateStyle: "medium",
      timeStyle: "short",
    });

    const html = buildReportHtml({
      areas,
      shops,
      adjustments,
      generatedAt,
    });

    return {
      html,
      generatedAt,
      areas: areas.length,
      shops: shops.length,
      adjustments: adjustments.length,
    };
  };

  const handlePdf = async () => {
    let reportWindow;

    try {
      setLoading("pdf");
      setMessage(null);

      const report = await generateReport();

      reportWindow = window.open("", "_blank");

      if (!reportWindow) {
        throw new Error(
          "Pop-up blocked. Please allow pop-ups for this app and try again."
        );
      }

      reportWindow.document.open();
      reportWindow.document.write(report.html);
      reportWindow.document.close();

      const savedHistory = saveDocumentHistory({
        id: `report-${Date.now()}`,
        name: "Complete Business Report",
        date: report.generatedAt,
        areas: report.areas,
        shops: report.shops,
        adjustments: report.adjustments,
      });

      setHistory(savedHistory);

      reportWindow.onload = () => {
        reportWindow.focus();
        reportWindow.print();
      };

      showMessage(
        "success",
        "Report generated. In the print window, choose Save as PDF."
      );
    } catch (error) {
      reportWindow?.close();

      showMessage(
        "error",
        error.message || "Could not generate PDF report."
      );
    } finally {
      setLoading("");
    }
  };

  const handleShare = async () => {
    try {
      setLoading("share");
      setMessage(null);

      const backup = await exportLocalBackup();

      const blob = new Blob(
        [JSON.stringify(backup, null, 2)],
        { type: "application/json" }
      );

      const file = new File(
        [blob],
        `miss-noori-backup-${new Date().toISOString().slice(0, 10)}.json`,
        { type: "application/json" }
      );

      if (
        navigator.share &&
        navigator.canShare?.({ files: [file] })
      ) {
        await navigator.share({
          title: "Miss Noori Database Backup",
          text: "Complete Miss Noori business database backup.",
          files: [file],
        });

        showMessage("success", "Share menu opened successfully.");
      } else {
        downloadBackup(backup);

        const text = encodeURIComponent(
          "Miss Noori complete database backup is downloaded. Please attach the JSON backup file to this message."
        );

        const choice = window.confirm(
          "Your browser does not support sharing files directly.\n\nPress OK to share through WhatsApp, or Cancel to open Email."
        );

        window.open(
          choice
            ? `https://wa.me/?text=${text}`
            : `mailto:?subject=Miss%20Noori%20Database%20Backup&body=${text}`,
          "_blank",
          "noopener,noreferrer"
        );

        showMessage(
          "success",
          "Backup downloaded. Attach the JSON file in the opened app."
        );
      }
    } catch (error) {
      if (error.name !== "AbortError") {
        showMessage(
          "error",
          error.message || "Could not share backup."
        );
      }
    } finally {
      setLoading("");
    }
  };

  const handleOpenHistory = async () => {
    try {
      setLoading("history");

      const report = await generateReport();
      const reportWindow = window.open("", "_blank");

      if (!reportWindow) {
        throw new Error("Please allow pop-ups to open the report.");
      }

      reportWindow.document.open();
      reportWindow.document.write(report.html);
      reportWindow.document.close();

      reportWindow.onload = () => {
        reportWindow.focus();
        reportWindow.print();
      };
    } catch (error) {
      showMessage("error", error.message);
    } finally {
      setLoading("");
    }
  };

  const handleClearHistory = () => {
    if (!window.confirm("Clear the generated document history?")) {
      return;
    }

    localStorage.removeItem(HISTORY_KEY);
    setHistory([]);
    showMessage("success", "Document history cleared.");
  };

  return (
    <div className="documents-page">
      <div className="documents-heading">
        <div>
          <h1>Documents</h1>
          <p>Manage your business backups and reports</p>
        </div>
      </div>

      {message && (
        <div className={`documents-message ${message.type}`}>
          {message.type === "success" ? (
            <CheckCircle2 size={19} />
          ) : (
            <AlertCircle size={19} />
          )}
          <span>{message.text}</span>
        </div>
      )}

      <div className="documents-grid">
        <div className="document-card">
          <Upload size={28} />
          <h3>Export All Data</h3>
          <p>
            Download all local database records in one JSON
            backup file. Transfer it to another device.
          </p>
          <button
            onClick={handleExport}
            disabled={Boolean(loading)}
          >
            {loading === "export" ? (
              <RefreshCw className="spin" size={16} />
            ) : (
              <Upload size={16} />
            )}
            Export Data
          </button>
        </div>

        <div className="document-card">
          <Download size={28} />
          <h3>Import Data</h3>
          <p>
            Restore a complete Miss Noori JSON backup.
            Existing data will be replaced after confirmation.
          </p>
          <button
            onClick={handleImportClick}
            disabled={Boolean(loading)}
          >
            {loading === "import" ? (
              <RefreshCw className="spin" size={16} />
            ) : (
              <Download size={16} />
            )}
            Import Data
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={handleImport}
          />
        </div>

        <div className="document-card">
          <FileDown size={28} />
          <h3>Overall PDF</h3>
          <p>
            Generate a current area-wise report with shop
            records, Unpaid balances and adjustment history.
          </p>
          <button
            onClick={handlePdf}
            disabled={Boolean(loading)}
          >
            {loading === "pdf" ? (
              <RefreshCw className="spin" size={16} />
            ) : (
              <Printer size={16} />
            )}
            Download PDF
          </button>
        </div>

        <div className="document-card">
          <Share2 size={28} />
          <h3>Share Documents</h3>
          <p>
            Share the complete database backup using
            WhatsApp, Email or your device's share menu.
          </p>
          <button
            onClick={handleShare}
            disabled={Boolean(loading)}
          >
            {loading === "share" ? (
              <RefreshCw className="spin" size={16} />
            ) : (
              <Share2 size={16} />
            )}
            Share Backup
          </button>
        </div>

        <div className="document-card">
          <FolderOpen size={28} />
          <h3>My Documents</h3>
          <p>
            View your generated report history and create
            the latest report again.
          </p>
          <button
            onClick={handleOpenHistory}
            disabled={Boolean(loading)}
          >
            {loading === "history" ? (
              <RefreshCw className="spin" size={16} />
            ) : (
              <FolderOpen size={16} />
            )}
            Open Latest Report
          </button>
        </div>
      </div>

      <section className="documents-history">
        <div className="documents-history-heading">
          <div>
            <h2>Generated Documents</h2>
            <p>Recent report generation history on this device</p>
          </div>

          {history.length > 0 && (
            <button
              className="documents-clear-btn"
              onClick={handleClearHistory}
            >
              <Trash2 size={15} />
              Clear History
            </button>
          )}
        </div>

        {history.length === 0 ? (
          <div className="documents-history-empty">
            <FileText size={30} />
            <p>No generated reports yet.</p>
          </div>
        ) : (
          <div className="documents-history-list">
            {history.map((item) => (
              <div className="documents-history-item" key={item.id}>
                <div className="documents-history-icon">
                  <FileText size={20} />
                </div>

                <div className="documents-history-info">
                  <strong>{item.name}</strong>
                  <span>{item.date}</span>
                  <small>
                    {item.areas} areas · {item.shops} shops ·{" "}
                    {item.adjustments} adjustments
                  </small>
                </div>

                <button
                  className="documents-history-open"
                  onClick={handleOpenHistory}
                  title="Generate latest report"
                >
                  <Printer size={17} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
