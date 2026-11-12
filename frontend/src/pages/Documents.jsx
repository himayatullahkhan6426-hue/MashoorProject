
import { useRef, useState } from "react";
import {
  Upload,
  Download,
  Share2,
  FileDown,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { jsPDF } from "jspdf";

import db from "../database/localDb";

import {
  exportLocalBackup,
  downloadBackup,
  restoreLocalBackup,
} from "../services/localBackup";

import "./Documents.css";

const formatRupees = (value) =>
  `Rs. ${Number(value || 0).toLocaleString("en-PK")}`;

const getShopBalance = (shop) => {
  const fields = [
    "Unpaid",
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
  "-";

const getShopPhone = (shop) =>
  shop.phone ||
  shop.phone_number ||
  shop.mobile ||
  shop.contact ||
  "-";

const getShopAddress = (shop) =>
  shop.address ||
  shop.shop_address ||
  shop.location ||
  "-";

const getShopStatus = (shop) =>
  shop.is_active === false || shop.is_active === 0
    ? "Inactive"
    : "Active";

const safeText = (value) =>
  String(value ?? "-").replace(/[^\x20-\x7E]/g, "");

const createBusinessPdf = ({
  areas,
  shops,
  adjustments,
  generatedAt,
}) => {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const margin = 10;
  const contentWidth = pageWidth - margin * 2;

  let y = margin;

  const totalUnpaid = shops.reduce(
    (sum, shop) => sum + getShopBalance(shop),
    0
  );

  const addPage = () => {
    doc.addPage();
    y = margin;
  };

  const checkPage = (height) => {
    if (y + height > pageHeight - 12) {
      addPage();
    }
  };

  const drawHeader = (title) => {
    checkPage(15);

    doc.setFillColor(29, 78, 216);
    doc.roundedRect(
      margin,
      y,
      contentWidth,
      11,
      2,
      2,
      "F"
    );

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);

    doc.text(title, margin + 4, y + 7);

    y += 15;
    doc.setTextColor(30, 41, 59);
  };

  const drawSectionTitle = (title) => {
    checkPage(14);

    doc.setFillColor(239, 246, 255);
    doc.rect(margin, y, contentWidth, 9, "F");

    doc.setFillColor(37, 99, 235);
    doc.rect(margin, y, 1.5, 9, "F");

    doc.setTextColor(30, 64, 175);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);

    doc.text(safeText(title), margin + 4, y + 6);

    y += 13;
  };

  const drawTable = (headers, rows, widths) => {
    const headerHeight = 9;
    const padding = 2;

    const drawTableHeader = () => {
      doc.setFillColor(30, 64, 175);
      doc.rect(margin, y, contentWidth, headerHeight, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(255, 255, 255);

      let x = margin;

      headers.forEach((header, index) => {
        const lines = doc.splitTextToSize(
          safeText(header),
          widths[index] - padding * 2
        );

        doc.text(
          lines,
          x + padding,
          y + 5.5
        );

        x += widths[index];
      });

      y += headerHeight;
    };

    drawTableHeader();

    if (!rows.length) {
      checkPage(10);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);

      doc.text(
        "No records available.",
        margin + 3,
        y + 6
      );

      y += 11;
      return;
    }

    rows.forEach((row, rowIndex) => {
      const cellLines = row.map((cell, index) =>
        doc.splitTextToSize(
          safeText(cell),
          widths[index] - padding * 2
        )
      );

      const maxLines = Math.max(
        ...cellLines.map((lines) => lines.length)
      );

      const rowHeight = Math.max(
        8,
        maxLines * 3.5 + padding * 2
      );

      if (y + rowHeight > pageHeight - 12) {
        addPage();
        drawTableHeader();
      }

      if (rowIndex % 2 === 0) {
        doc.setFillColor(248, 250, 252);
        doc.rect(
          margin,
          y,
          contentWidth,
          rowHeight,
          "F"
        );
      }

      doc.setDrawColor(220, 228, 239);
      doc.setLineWidth(0.15);

      doc.rect(
        margin,
        y,
        contentWidth,
        rowHeight
      );

      let x = margin;

      cellLines.forEach((lines, index) => {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(30, 41, 59);

        doc.text(
          lines,
          x + padding,
          y + padding + 2.5
        );

        if (index > 0) {
          doc.line(
            x,
            y,
            x,
            y + rowHeight
          );
        }

        x += widths[index];
      });

      y += rowHeight;
    });

    y += 5;
  };

  // REPORT HEADER

  doc.setTextColor(29, 78, 216);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(23);

  doc.text("Miss Noori", margin, y + 8);

  y += 12;

  doc.setTextColor(100, 116, 139);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  doc.text(
    "Cosmetics Distribution - Complete Business Report",
    margin,
    y
  );

  y += 6;

  doc.setFontSize(8);
  doc.text(
    `Generated: ${safeText(generatedAt)}`,
    margin,
    y
  );

  y += 8;

  doc.setDrawColor(37, 99, 235);
  doc.setLineWidth(0.8);

  doc.line(
    margin,
    y,
    pageWidth - margin,
    y
  );

  y += 9;

  // SUMMARY CARDS

  const cardGap = 5;
  const cardWidth = (contentWidth - cardGap * 2) / 3;
  const cardHeight = 19;

  const stats = [
    {
      label: "Total Areas",
      value: String(areas.length),
    },
    {
      label: "Total Shops",
      value: String(shops.length),
    },
    {
      label: "Total Unpaid",
      value: formatRupees(totalUnpaid),
    },
  ];

  stats.forEach((stat, index) => {
    const x =
      margin + index * (cardWidth + cardGap);

    doc.setFillColor(239, 246, 255);
    doc.setDrawColor(219, 234, 254);

    doc.roundedRect(
      x,
      y,
      cardWidth,
      cardHeight,
      2,
      2,
      "FD"
    );

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);

    doc.text(stat.label, x + 4, y + 6);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(29, 78, 216);

    doc.text(
      safeText(stat.value),
      x + 4,
      y + 14
    );
  });

  y += cardHeight + 12;

  // AREA-WISE SHOP RECORDS

  drawSectionTitle("Area-wise Shop Records");

  const shopHeaders = [
    "#",
    "Shop Name",
    "Owner",
    "Contact",
    "Address",
    "Unpaid",
    "Status",
  ];

  const shopWidths = [
    10,
    46,
    34,
    34,
    72,
    46,
    35,
  ];

  const sortedAreas = [...areas].sort((a, b) =>
    String(a.name || "").localeCompare(
      String(b.name || "")
    )
  );

  sortedAreas.forEach((area) => {
    const areaShops = shops
      .filter(
        (shop) =>
          String(shop.area_id) === String(area.id)
      )
      .sort((a, b) =>
        String(a.shop_name || "").localeCompare(
          String(b.shop_name || "")
        )
      );

    const areaTotal = areaShops.reduce(
      (sum, shop) => sum + getShopBalance(shop),
      0
    );

    checkPage(20);

    doc.setFillColor(239, 246, 255);
    doc.rect(margin, y, contentWidth, 11, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(30, 64, 175);

    doc.text(
      safeText(area.name || "Unnamed Area"),
      margin + 3,
      y + 7
    );

    doc.setFontSize(8);

    doc.text(
      `${areaShops.length} shops`,
      margin + 75,
      y + 7
    );

    doc.text(
      `Area Unpaid: ${formatRupees(areaTotal)}`,
      pageWidth - margin - 3,
      y + 7,
      { align: "right" }
    );

    y += 12;

    const rows = areaShops.map((shop, index) => [
      String(index + 1),
      shop.shop_name || "Unnamed Shop",
      getShopOwner(shop),
      getShopPhone(shop),
      getShopAddress(shop),
      formatRupees(getShopBalance(shop)),
      getShopStatus(shop),
    ]);

    drawTable(shopHeaders, rows, shopWidths);
  });

  // UNASSIGNED SHOPS

  const unassignedShops = shops
    .filter(
      (shop) =>
        !areas.some(
          (area) =>
            String(area.id) === String(shop.area_id)
        )
    )
    .sort((a, b) =>
      String(a.shop_name || "").localeCompare(
        String(b.shop_name || "")
      )
    );

  if (unassignedShops.length) {
    drawSectionTitle("Other Shops - Unassigned Area");

    const rows = unassignedShops.map((shop, index) => [
      String(index + 1),
      shop.shop_name || "Unnamed Shop",
      getShopOwner(shop),
      getShopPhone(shop),
      getShopAddress(shop),
      formatRupees(getShopBalance(shop)),
      getShopStatus(shop),
    ]);

    drawTable(shopHeaders, rows, shopWidths);
  }

  // ADJUSTMENT HISTORY

  drawSectionTitle("Adjustment History");

  const sortedAdjustments = [...adjustments].sort(
    (a, b) =>
      new Date(b.adjustment_date || 0) -
      new Date(a.adjustment_date || 0)
  );

  const adjustmentRows = sortedAdjustments.map(
    (item, index) => {
      const shop = shops.find(
        (entry) =>
          String(entry.id) === String(item.shop_id)
      );

      return [
        String(index + 1),
        shop?.shop_name || "Unknown Shop",
        item.adjustment_type || "-",
        item.description || item.reason || "-",
        formatRupees(
          item.amount || item.adjustment_amount || 0
        ),
        item.adjustment_date || "-",
      ];
    }
  );

  drawTable(
    [
      "#",
      "Shop",
      "Type",
      "Description",
      "Amount",
      "Date",
    ],
    adjustmentRows,
    [10, 52, 38, 92, 45, 40]
  );

  // OVERALL SUMMARY

  checkPage(28);

  doc.setFillColor(241, 245, 249);
  doc.roundedRect(
    margin,
    y,
    contentWidth,
    19,
    2,
    2,
    "F"
  );

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);

  doc.text("Overall Summary", margin + 4, y + 6);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);

  doc.text(
    `Areas: ${areas.length}  |  Shops: ${shops.length}  |  Adjustments: ${adjustments.length}  |  Total Unpaid: ${formatRupees(totalUnpaid)}`,
    margin + 4,
    y + 13
  );

  // FOOTERS AND PAGE NUMBERS

  const pageCount = doc.internal.getNumberOfPages();

  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page);

    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.2);

    doc.line(
      margin,
      pageHeight - 9,
      pageWidth - margin,
      pageHeight - 9
    );

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);

    doc.text(
      "Miss Noori Cosmetics Management Software",
      margin,
      pageHeight - 5
    );

    doc.text(
      `Page ${page} of ${pageCount}`,
      pageWidth - margin,
      pageHeight - 5,
      { align: "right" }
    );
  }

  return doc.output("blob");
};

export default function Documents() {
  const fileInputRef = useRef(null);

  const [loading, setLoading] = useState("");
  const [message, setMessage] = useState(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [shareType, setShareType] = useState("pdf");

  const showMessage = (type, text) => {
    setMessage({ type, text });
  };

  const getReport = async () => {
    const [areas, shops, adjustments] = await Promise.all([
      db.areas.toArray(),
      db.shops.toArray(),
      db.adjustments.toArray(),
    ]);

    const generatedAt = new Date().toLocaleString(
      "en-PK",
      {
        dateStyle: "medium",
        timeStyle: "short",
      }
    );

    return {
      areas,
      shops,
      adjustments,
      generatedAt,
    };
  };

  const createPdfBlob = async (report) => {
    const blob = createBusinessPdf(report);

    if (!blob || blob.size < 1000) {
      throw new Error("PDF generation failed.");
    }

    return blob;
  };

  const downloadBlob = (blob, fileName) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = fileName;

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  const handleExport = async () => {
    try {
      setLoading("export");
      setMessage(null);

      const backup = await exportLocalBackup();
      downloadBackup(backup);

      showMessage(
        "success",
        "Complete database JSON backup downloaded successfully."
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

      const backup = JSON.parse(await file.text());

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

  const handlePdf = async () => {
    try {
      setLoading("pdf");
      setMessage(null);

      const report = await getReport();
      const pdfBlob = await createPdfBlob(report);

      downloadBlob(
        pdfBlob,
        `miss-noori-overall-report-${new Date()
          .toISOString()
          .slice(0, 10)}.pdf`
      );

      showMessage(
        "success",
        "Overall business report PDF downloaded successfully."
      );
    } catch (error) {
      console.error("PDF generation error:", error);

      showMessage(
        "error",
        error.message || "Could not download PDF report."
      );
    } finally {
      setLoading("");
    }
  };

  const handleWhatsAppShare = async () => {
    const number = whatsappNumber.replace(/\D/g, "");

    if (number.length < 8 || number.length > 15) {
      showMessage(
        "error",
        "Please enter a valid WhatsApp number with country code, e.g. 923001234567."
      );
      return;
    }

    const whatsappWindow = window.open("about:blank", "_blank");

    try {
      setLoading("share");
      setMessage(null);

      let fileName = "";
      let messageText = "";

      if (shareType === "pdf") {
        const report = await getReport();
        const pdfBlob = await createPdfBlob(report);

        fileName = `miss-noori-overall-report-${new Date()
          .toISOString()
          .slice(0, 10)}.pdf`;

        downloadBlob(pdfBlob, fileName);

        messageText =
          "Miss Noori Overall Business Report PDF. Please find the downloaded file attached.";
      } else {
        const backup = await exportLocalBackup();

        const jsonBlob = new Blob(
          [JSON.stringify(backup, null, 2)],
          { type: "application/json" }
        );

        fileName = `miss-noori-backup-${new Date()
          .toISOString()
          .slice(0, 10)}.json`;

        downloadBlob(jsonBlob, fileName);

        messageText =
          "Miss Noori complete database backup. Please find the downloaded JSON file attached.";
      }

      const whatsappUrl = `https://wa.me/${number}?text=${encodeURIComponent(
        messageText
      )}`;

      if (whatsappWindow) {
        whatsappWindow.location.href = whatsappUrl;
      } else {
        window.location.href = whatsappUrl;
      }

      setShareOpen(false);
      setWhatsappNumber("");

      showMessage(
        "success",
        `${fileName} downloaded and WhatsApp chat opened. Attach the downloaded file in that chat and press Send.`
      );
    } catch (error) {
      whatsappWindow?.close();

      console.error("WhatsApp sharing error:", error);

      showMessage(
        "error",
        error.message || "Could not prepare WhatsApp document."
      );
    } finally {
      setLoading("");
    }
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

          <div className="document-card-actions">
            <button
              className="document-primary-btn"
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

            <button
              className="document-whatsapp-btn"
              onClick={() => {
                setShareType("json");
                setShareOpen(true);
              }}
              disabled={Boolean(loading)}
            >
              <Share2 size={16} />
              Share on WhatsApp
            </button>
          </div>
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
            Download an area-wise business report with shop
            records, Unpaid balances and adjustment history.
          </p>

          <div className="document-card-actions">
            <button
              className="document-primary-btn"
              onClick={handlePdf}
              disabled={Boolean(loading)}
            >
              {loading === "pdf" ? (
                <RefreshCw className="spin" size={16} />
              ) : (
                <FileDown size={16} />
              )}
              Download PDF
            </button>

            <button
              className="document-whatsapp-btn"
              onClick={() => {
                setShareType("pdf");
                setShareOpen(true);
              }}
              disabled={Boolean(loading)}
            >
              <Share2 size={16} />
              Share on WhatsApp
            </button>
          </div>
        </div>
      </div>

      {shareOpen && (
        <div
          className="whatsapp-modal-overlay"
          onClick={() => setShareOpen(false)}
        >
          <div
            className="whatsapp-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="whatsapp-share-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="whatsapp-modal-header">
              <div>
                <h2 id="whatsapp-share-title">
                  Share on WhatsApp
                </h2>

                <p>
                  {shareType === "pdf"
                    ? "Share the Overall PDF report."
                    : "Share the complete JSON database backup."}
                </p>
              </div>

              <button
                type="button"
                className="whatsapp-modal-close"
                onClick={() => setShareOpen(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <label htmlFor="whatsapp-number">
              WhatsApp Number
            </label>

            <input
              id="whatsapp-number"
              type="tel"
              inputMode="numeric"
              placeholder="923001234567"
              value={whatsappNumber}
              onChange={(event) =>
                setWhatsappNumber(event.target.value)
              }
            />

            <small className="whatsapp-number-hint">
              Enter country code without + or spaces.
              Example: 923001234567
            </small>

            <button
              type="button"
              className="whatsapp-continue-btn"
              onClick={handleWhatsAppShare}
              disabled={Boolean(loading)}
            >
              {loading === "share" ? (
                <RefreshCw className="spin" size={17} />
              ) : (
                <Share2 size={17} />
              )}

              {loading === "share"
                ? "Preparing File..."
                : "Continue to WhatsApp"}
            </button>

            <p className="whatsapp-modal-note">
              The file will be downloaded and the selected WhatsApp
              chat will open. Attach the downloaded file in the chat
              and press Send.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
