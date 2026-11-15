
import { useEffect, useRef, useState } from "react";
import {
  Upload,
  Download,
  Share2,
  FileDown,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Eye,
} from "lucide-react";
import { jsPDF } from "jspdf";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

import db from "../database/localDb";

import {
  exportLocalBackup,
  downloadBackup,
  restoreLocalBackup,
} from "../services/localBackup";

import "./Documents.css";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const formatRupees = (value) =>
  `Rs. ${Number(value || 0).toLocaleString("en-PK")}`;

const getShopBalance = (shop) => {
  const balance =
    shop.unpaid_balance ??
    shop.opening_balance ??
    shop.Unpaid ??
    shop.balance ??
    shop.current_balance ??
    shop.remaining_balance ??
    shop.outstanding_balance ??
    0;

  const numericBalance = Number(balance);

  return Number.isFinite(numericBalance) ? numericBalance : 0;
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

const safeText = (value) =>
  String(value ?? "-").replace(/[^\x20-\x7E]/g, "");

// LOCAL DATE: YYYY-MM-DD

const getTodayDate = () => {
  const now = new Date();

  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
};

// TRANSACTION TIMESTAMP

const getTransactionTimestamp = (item) => {
  const timestamp =
    item.created_at ||
    item.createdAt ||
    item.timestamp ||
    item.adjustment_datetime ||
    item.date_created ||
    item.updated_at;

  if (timestamp) {
    const date = new Date(timestamp);

    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }

  // Use adjustment_date only if it contains a time too.
  const adjustmentDate = String(
    item.adjustment_date || ""
  );

  if (adjustmentDate.includes("T")) {
    const date = new Date(adjustmentDate);

    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }

  return null;
};

// TRANSACTION TIME

const getTransactionTime = (item) => {
  const date = getTransactionTimestamp(item);

  if (!date) return "-";

  return date.toLocaleTimeString("en-PK", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
};

// CREATE BUSINESS PDF

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

  // DRAW TABLE

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

        doc.text(lines, x + padding, y + 5.5);
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

      doc.text("No records available.", margin + 3, y + 6);

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
        doc.rect(margin, y, contentWidth, rowHeight, "F");
      }

      doc.setDrawColor(220, 228, 239);
      doc.setLineWidth(0.15);

      doc.rect(margin, y, contentWidth, rowHeight);

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
          doc.line(x, y, x, y + rowHeight);
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
  doc.text(`Generated: ${safeText(generatedAt)}`, margin, y);

  y += 8;

  doc.setDrawColor(37, 99, 235);
  doc.setLineWidth(0.8);
  doc.line(margin, y, pageWidth - margin, y);

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
    const x = margin + index * (cardWidth + cardGap);

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

    doc.text(safeText(stat.value), x + 4, y + 14);
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
  ];

  const shopWidths = [
    10,
    48,
    36,
    35,
    90,
    58,
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
    ]);

    drawTable(shopHeaders, rows, shopWidths);
  }

  // TODAY'S ADDED AND RECEIVED TRANSACTIONS

  const today = getTodayDate();

  const todayAdjustments = adjustments.filter(
    (item) =>
      String(item.adjustment_date || "").slice(0, 10) === today
  );

  const getTodayTransactionRows = (type) => {
    return todayAdjustments
      .filter(
        (item) =>
          String(item.adjustment_type || "").toUpperCase() === type
      )
      .sort((a, b) => {
        const dateA = getTransactionTimestamp(a);
        const dateB = getTransactionTimestamp(b);

        return (
          (dateB?.getTime() || 0) -
          (dateA?.getTime() || 0)
        );
      })
      .map((item, index) => {
        const shop = shops.find(
          (entry) =>
            String(entry.id) === String(item.shop_id)
        );

        return [
          String(index + 1),
          shop?.shop_name || "Unknown Shop",
          getTransactionTime(item),
          formatRupees(
            item.amount || item.adjustment_amount || 0
          ),
        ];
      });
  };

  // DRAW TODAY'S TRANSACTION SECTION

  const drawTodayTransactionSection = (
    title,
    type,
    color
  ) => {
    checkPage(25);

    doc.setFillColor(...color.background);
    doc.rect(margin, y, contentWidth, 9, "F");

    doc.setFillColor(...color.text);
    doc.rect(margin, y, 1.5, 9, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...color.text);

    doc.text(title, margin + 4, y + 6);

    y += 13;

    const rows = getTodayTransactionRows(type);

    drawTable(
      [
        "#",
        "Shop Name",
        "Transaction Time",
        "Amount",
      ],
      rows,
      [15, 110, 70, 82]
    );
  };

  // TODAY'S ADDED - RED

  drawTodayTransactionSection(
    "Today's Added",
    "ADD",
    {
      background: [254, 226, 226],
      text: [220, 38, 38],
    }
  );

  // TODAY'S RECEIVED - PURPLE

  drawTodayTransactionSection(
    "Today's Received",
    "SUBTRACT",
    {
      background: [237, 233, 254],
      text: [118, 83, 214],
    }
  );

  // TODAY'S TRANSACTION COUNTS

  const todayAddedCount = todayAdjustments.filter(
    (item) =>
      String(item.adjustment_type || "").toUpperCase() === "ADD"
  ).length;

  const todayReceivedCount = todayAdjustments.filter(
    (item) =>
      String(item.adjustment_type || "").toUpperCase() === "SUBTRACT"
  ).length;

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
    `Areas: ${areas.length}  |  Shops: ${shops.length}  |  Today's Added: ${todayAddedCount}  |  Today's Received: ${todayReceivedCount}  |  Total Unpaid: ${formatRupees(totalUnpaid)}`,
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

// PDF.JS MOBILE + DESKTOP PREVIEW

function PdfMobilePreview({ url }) {
  const containerRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!url) return;

    let cancelled = false;
    let loadingTask = null;
    const renderTasks = [];

    const renderPdf = async () => {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(url);

        if (!response.ok) {
          throw new Error("Could not load PDF file.");
        }

        const data = await response.arrayBuffer();

        if (cancelled) return;

        loadingTask = pdfjsLib.getDocument({
          data: new Uint8Array(data),
        });

        const pdf = await loadingTask.promise;

        if (cancelled) return;

        const container = containerRef.current;

        if (!container) return;

        container.replaceChildren();

        for (
          let pageNumber = 1;
          pageNumber <= pdf.numPages;
          pageNumber++
        ) {
          if (cancelled) return;

          const page = await pdf.getPage(pageNumber);

          if (cancelled) return;

          const baseViewport = page.getViewport({
            scale: 1,
          });

          const availableWidth = Math.max(
            280,
            container.clientWidth - 20
          );

          const scale =
            availableWidth / baseViewport.width;

          const viewport = page.getViewport({
            scale,
          });

          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d");

          if (!context) {
            throw new Error("Could not render PDF page.");
          }

          const pixelRatio = Math.min(
            window.devicePixelRatio || 1,
            2
          );

          canvas.width = Math.floor(
            viewport.width * pixelRatio
          );

          canvas.height = Math.floor(
            viewport.height * pixelRatio
          );

          canvas.style.width = "100%";
          canvas.style.height = "auto";
          canvas.style.display = "block";
          canvas.style.marginBottom = "14px";
          canvas.style.background = "#fff";
          canvas.style.boxShadow =
            "0 2px 8px rgba(0,0,0,0.12)";

          container.appendChild(canvas);

          const renderTask = page.render({
            canvasContext: context,
            viewport,
            transform: [
              pixelRatio,
              0,
              0,
              pixelRatio,
              0,
              0,
            ],
          });

          renderTasks.push(renderTask);

          await renderTask.promise;
        }

        if (!cancelled) {
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("PDF preview error:", err);

          setError(
            err.message ||
              "PDF preview could not be loaded."
          );

          setLoading(false);
        }
      }
    };

    renderPdf();

    return () => {
      cancelled = true;

      renderTasks.forEach((task) => {
        try {
          task.cancel();
        } catch {
          // Ignore already completed render tasks.
        }
      });

      if (loadingTask) {
        loadingTask.destroy();
      }
    };
  }, [url]);

  return (
    <div className="pdf-js-preview">
      {loading && (
        <div className="pdf-preview-status">
          <RefreshCw className="spin" size={24} />
          <p>Loading PDF pages...</p>
        </div>
      )}

      {error && (
        <div className="pdf-preview-status pdf-preview-error">
          <AlertCircle size={24} />
          <p>{error}</p>
        </div>
      )}

      <div
        ref={containerRef}
        className="pdf-js-pages"
      />
    </div>
  );
}

// DOCUMENTS COMPONENT

export default function Documents() {
  const fileInputRef = useRef(null);
  const pdfPreviewUrlRef = useRef(null);

  const [loading, setLoading] = useState("");
  const [message, setMessage] = useState(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [shareType, setShareType] = useState("pdf");

  const [pdfPreviewUrl, setPdfPreviewUrl] = useState("");
  const [previewLoading, setPreviewLoading] = useState(true);
  const [previewError, setPreviewError] = useState("");

  const showMessage = (type, text) => {
    setMessage({ type, text });
  };

  // GET REPORT DATA

  const getReport = async () => {
    const [areas, shops, adjustments] = await Promise.all([
      db.areas.toArray(),
      db.shops.toArray(),
      db.adjustments.toArray(),
    ]);

    const generatedAt = new Date().toLocaleString("en-PK", {
      dateStyle: "medium",
      timeStyle: "short",
    });

    return {
      areas,
      shops,
      adjustments,
      generatedAt,
    };
  };

  // CREATE PDF BLOB

  const createPdfBlob = async (report) => {
    const blob = createBusinessPdf(report);

    if (!blob || blob.size < 1000) {
      throw new Error("PDF generation failed.");
    }

    return blob;
  };

  // UPDATE PDF PREVIEW

  const updatePdfPreview = (blob) => {
    if (pdfPreviewUrlRef.current) {
      URL.revokeObjectURL(pdfPreviewUrlRef.current);
    }

    const url = URL.createObjectURL(blob);

    pdfPreviewUrlRef.current = url;
    setPdfPreviewUrl(url);
    setPreviewError("");
    setPreviewLoading(false);
  };

  // GENERATE PDF PREVIEW WHEN PAGE OPENS

  useEffect(() => {
    let cancelled = false;

    const generatePreview = async () => {
      try {
        setPreviewLoading(true);

        const [areas, shops, adjustments] = await Promise.all([
          db.areas.toArray(),
          db.shops.toArray(),
          db.adjustments.toArray(),
        ]);

        const generatedAt = new Date().toLocaleString("en-PK", {
          dateStyle: "medium",
          timeStyle: "short",
        });

        const blob = createBusinessPdf({
          areas,
          shops,
          adjustments,
          generatedAt,
        });

        if (!blob || blob.size < 1000) {
          throw new Error(
            "PDF preview could not be generated."
          );
        }

        if (!cancelled) {
          updatePdfPreview(blob);
        }
      } catch (error) {
        if (!cancelled) {
          setPreviewError(
            error.message ||
              "Could not load PDF preview."
          );

          setPreviewLoading(false);
        }
      }
    };

    generatePreview();

    return () => {
      cancelled = true;
    };
  }, []);

  // CLEAN UP PREVIEW URL ON UNMOUNT

  useEffect(() => {
    return () => {
      if (pdfPreviewUrlRef.current) {
        URL.revokeObjectURL(pdfPreviewUrlRef.current);
        pdfPreviewUrlRef.current = null;
      }
    };
  }, []);

  // DOWNLOAD BLOB

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

  // EXPORT BACKUP

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

  // OPEN IMPORT FILE PICKER

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  // SAFE MERGE IMPORT

  const handleImport = async (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    try {
      setLoading("import");
      setMessage(null);

      if (!file.name.toLowerCase().endsWith(".json")) {
        throw new Error(
          "Please select a valid JSON backup file."
        );
      }

      const backup = JSON.parse(await file.text());

      const confirmed = window.confirm(
        "MERGE BACKUP DATA\n\n" +
          "Only records missing from your current database will be imported.\n\n" +
          "Existing areas, shops, Unpaid balances and adjustment history will NOT be replaced or deleted.\n\n" +
          "A backup of your current database will be downloaded first.\n\n" +
          "Do you want to continue?"
      );

      if (!confirmed) return;

      const result = await restoreLocalBackup(backup);

      showMessage(
        "success",
        `Merge successful! ${result.totalInserted} new records imported and ${result.totalSkipped} existing or duplicate records skipped. Your existing data was preserved. A safety backup was also downloaded.`
      );
    } catch (error) {
      showMessage(
        "error",
        error.message || "Could not merge backup data."
      );
    } finally {
      setLoading("");
      event.target.value = "";
    }
  };

  // DOWNLOAD PDF

  const handlePdf = async () => {
    try {
      setLoading("pdf");
      setMessage(null);

      const report = await getReport();
      const pdfBlob = await createPdfBlob(report);

      updatePdfPreview(pdfBlob);

      downloadBlob(
        pdfBlob,
        `miss-noori-overall-report-${getTodayDate()}.pdf`
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

  // WHATSAPP SHARE

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

        updatePdfPreview(pdfBlob);

        fileName = `miss-noori-overall-report-${getTodayDate()}.pdf`;

        downloadBlob(pdfBlob, fileName);

        messageText =
          "Miss Noori Overall Business Report PDF. Please find the downloaded file attached.";
      } else {
        const backup = await exportLocalBackup();

        const jsonBlob = new Blob(
          [JSON.stringify(backup, null, 2)],
          { type: "application/json" }
        );

        fileName = `miss-noori-backup-${getTodayDate()}.json`;

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
        error.message ||
          "Could not prepare WhatsApp document."
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
          <p>
            Manage your business reports and database backups
          </p>
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

      <div className="documents-grid documents-layout">
        {/* OVERALL PDF */}

        <div className="document-card pdf-document-card">
          <div className="pdf-document-heading">
            <div>
              <div className="pdf-title-icon">
                <FileDown size={25} />
              </div>

              <h3>Overall Business Report</h3>

              <p>
                Preview your complete business report below.
                It includes areas, shops, Unpaid balances and
                today's Added and Received transactions.
              </p>
            </div>
          </div>

          {/* PDF ACTION BUTTONS */}

          <div className="document-card-actions pdf-actions">
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

              {loading === "pdf"
                ? "Preparing PDF..."
                : "Download PDF"}
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

          {/* PDF PREVIEW */}

          <div className="pdf-preview-section">
            <div className="pdf-preview-heading">
              <div>
                <Eye size={17} />
                <span>PDF Preview</span>
              </div>

              <span className="pdf-preview-format">
                A4 Landscape
              </span>
            </div>

            {previewLoading && (
              <div className="pdf-preview-status">
                <RefreshCw className="spin" size={24} />
                <p>
                  Generating your business report...
                </p>
              </div>
            )}

            {previewError && !previewLoading && (
              <div className="pdf-preview-status pdf-preview-error">
                <AlertCircle size={24} />
                <p>{previewError}</p>

                <button
                  type="button"
                  onClick={() => window.location.reload()}
                >
                  Reload Preview
                </button>
              </div>
            )}

            {pdfPreviewUrl && !previewLoading && (
              <PdfMobilePreview url={pdfPreviewUrl} />
            )}
          </div>
        </div>

        {/* DATABASE BACKUP */}

        <div className="document-card backup-document-card">
          <div className="backup-document-heading">
            <div className="backup-title-icon">
              <Upload size={25} />
            </div>

            <div>
              <h3>Database Backup</h3>

              <p>
                Export your complete database or merge a
                previously exported backup. Existing records
                will never be replaced or deleted.
              </p>
            </div>
          </div>

          <div className="backup-actions">
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

              {loading === "export"
                ? "Exporting..."
                : "Export All Data"}
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
              Share Backup on WhatsApp
            </button>

            <button
              className="backup-import-btn"
              onClick={handleImportClick}
              disabled={Boolean(loading)}
            >
              {loading === "import" ? (
                <RefreshCw className="spin" size={16} />
              ) : (
                <Download size={16} />
              )}

              {loading === "import"
                ? "Importing..."
                : "Import Backup"}
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={handleImport}
          />

          <div className="backup-info">
            <AlertCircle size={17} />

            <p>
              Import uses safe merge. Only missing records
              are added. Your existing areas, shops, Unpaid
              balances and adjustment history are preserved.
            </p>
          </div>
        </div>
      </div>

      {/* WHATSAPP MODAL */}

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
              The file will be downloaded and the selected
              WhatsApp chat will open. Attach the downloaded
              file in the chat and press Send.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
