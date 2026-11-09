/* eslint-disable @typescript-eslint/no-explicit-any */
import { format, isValid } from 'date-fns';
import { toast } from 'sonner';

export function numberToWords(num: number): string {
  if (num === 0) return 'Zero';

  const a = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const convertBengaliStyle = (n: number): string => {
    if (n < 0) return 'Minus ' + convertBengaliStyle(Math.abs(n));
    let words = '';

    if (n >= 10000000) {
      words += convertBengaliStyle(Math.floor(n / 10000000)) + ' Crore ';
      n %= 10000000;
    }

    if (n >= 100000) {
      words += convertBengaliStyle(Math.floor(n / 100000)) + ' Lakh ';
      n %= 100000;
    }

    if (n >= 1000) {
      words += convertBengaliStyle(Math.floor(n / 1000)) + ' Thousand ';
      n %= 1000;
    }

    if (n >= 100) {
      words += convertBengaliStyle(Math.floor(n / 100)) + ' Hundred ';
      n %= 100;
    }

    if (n > 0) {
      if (n < 20) {
        words += a[n];
      } else {
        words += b[Math.floor(n / 10)];
        if (n % 10 > 0) {
          words += ' ' + a[n % 10];
        }
      }
    }

    return words.trim();
  };

  return convertBengaliStyle(num).trim();
}

// Converts TipTap JSON node to safe HTML
function renderDescriptionNode(node: any): string {
  if (!node) return '';
  if (node.type === 'text') {
    let text = (node.text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
    if (node.marks) {
      node.marks.forEach((mark: any) => {
        if (mark.type === 'bold') text = `<strong>${text}</strong>`;
        else if (mark.type === 'italic') text = `<em>${text}</em>`;
        else if (mark.type === 'underline') text = `<u>${text}</u>`;
        else if (mark.type === 'strike') text = `<s>${text}</s>`;
        else if (mark.type === 'textStyle') {
          const color = mark.attrs?.color;
          if (color) text = `<span style="color:${color}">${text}</span>`;
        } else if (mark.type === 'highlight') {
          const color = mark.attrs?.color;
          text = color ? `<mark style="background-color:${color}">${text}</mark>` : `<mark>${text}</mark>`;
        }
      });
    }
    return text;
  }
  const children = node.content ? node.content.map(renderDescriptionNode).join('') : '';
  switch (node.type) {
    case 'doc': return children;
    case 'paragraph': return `<p style="margin:2px 0">${children || '&nbsp;'}</p>`;
    case 'hardBreak': return '<br>';
    case 'heading': {
      const level = Math.max(1, Math.min(6, Number(node.attrs?.level) || 2));
      return `<h${level} style="margin:4px 0;font-weight:600">${children}</h${level}>`;
    }
    case 'bulletList': return `<ul style="margin:2px 0;padding-left:16px;list-style:disc">${children}</ul>`;
    case 'orderedList': return `<ol style="margin:2px 0;padding-left:16px;list-style:decimal">${children}</ol>`;
    case 'listItem': return `<li style="margin:1px 0">${children}</li>`;
    case 'blockquote': return `<blockquote style="border-left:3px solid #ccc;padding-left:8px;margin:4px 0">${children}</blockquote>`;
    case 'horizontalRule': return '<hr style="margin:4px 0">';
    default: return children;
  }
}

// Splits description into individual printable lines so Chrome print pagination
// can break cleanly between rows and reliably repeat the table heading (thead).
export function getDescriptionLines(description?: string): string[] {
  if (!description) return [];
  const trimmed = description.trim();
  if (trimmed.startsWith('{')) {
    try {
      let parsed = JSON.parse(trimmed);
      if (typeof parsed === 'string') parsed = JSON.parse(parsed);
      if (parsed && parsed.type === 'doc' && Array.isArray(parsed.content)) {
        const lines: string[] = [];
        parsed.content.forEach((child: any) => {
          const html = renderDescriptionNode(child);
          if (html && html.trim() && html !== '<p style="margin:2px 0">&nbsp;</p>') {
            lines.push(html);
          }
        });
        if (lines.length > 0) return lines;
      }
      const fullHtml = renderDescriptionNode(parsed);
      if (fullHtml) return [fullHtml];
    } catch {
      // not JSON, fall through to plain text
    }
  }

  // Plain text fallback
  return trimmed
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map(line => {
      return line
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    });
}

// Kept for backward compatibility with other components
export function generateDescriptionHtml(description?: string): string {
  const lines = getDescriptionLines(description);
  if (lines.length === 0) return '';
  return lines.map(l => `<div style="margin:1px 0;line-height:1.4;">${l}</div>`).join('');
}

export async function generateBillPDF(bill: any, settings: any, mode: 'download' | 'print' = 'download') {
  const brandName = settings?.brandName || "Inflation Engineering";
  const brandEmail = settings?.contact?.email || "";
  const brandPhone = settings?.contact?.phone || "";
  const brandAddress = settings?.contact?.address || "";

  // Dynamic colors based on shadcn/tailwind config (HSL values usually)
  let primary = '#00D1B2';
  let primaryForeground = '#ffffff';
  let border = '#e2e8f0';
  let mutedForeground = '#64748b';
  let foreground = '#0f172a';
  let background = '#ffffff';

  if (typeof window !== 'undefined') {
    const rootStyle = getComputedStyle(document.documentElement);
    const getColor = (varName: string, fallback: string) => {
      const val = rootStyle.getPropertyValue(varName).trim();
      if (!val) return fallback;
      if (val.startsWith('#') || val.startsWith('rgb') || val.startsWith('hsl') || val.startsWith('oklch') || val.includes('(')) {
        return val;
      }
      return `hsl(${val})`;
    };
    primary = getColor('--primary', primary);
    primaryForeground = getColor('--primary-foreground', primaryForeground);
    border = getColor('--border', border);
    mutedForeground = getColor('--muted-foreground', mutedForeground);
    foreground = getColor('--foreground', foreground);
    background = getColor('--background', background);
  }

  const getAbsoluteUrl = (url: string) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) return url;
    if (typeof window !== 'undefined') {
      return `${window.location.origin}${url.startsWith('/') ? '' : '/'}${url}`;
    }
    return url;
  };

  const brandLogoUrl = settings?.logoUrl || settings?.logo || '/logo.webp';
  const finalLogoUrl = getAbsoluteUrl(brandLogoUrl);
  const finalSignUrl = getAbsoluteUrl('/assets/sign.png');

  const docType = bill.documentType || (bill.billNo ? 'supplier-bill' : 'bill');

  // Titles & Labels
  let title = "BILL INVOICE";
  let labelTo = "BILL TO:";
  let labelNo = "BILL NO #:";
  if (docType === 'offer') {
    title = "QUOTATION";
    labelTo = "QUOTATION TO:";
    labelNo = "QUOTATION NO #:";
  } else if (docType === 'chalan') {
    title = "DELIVERY CHALLAN";
    labelTo = "DELIVER TO:";
    labelNo = "CHALLAN NO #:";
  } else if (docType === 'supplier-bill') {
    title = "PURCHASE BILL";
    labelTo = "SUPPLIER:";
    labelNo = "BILL NO #:";
  }

  const invoiceId = String(bill.invoiceNo || bill.billNo || bill._id || "").slice(-11).toUpperCase();
  const billDate = bill.date ? new Date(bill.date) : new Date();
  const formattedDate = billDate && isValid(billDate) ? format(billDate, "dd MMM yyyy") : "N/A";

  const items = Array.isArray(bill.items) ? bill.items : [];

  let footerThankYou = `Thank you for doing business with ${brandName}!`;
  let footerGenerated = `This is a computer generated bill, no signature required.`;
  if (docType === 'offer') {
    footerThankYou = `Thank you for requesting a quotation from ${brandName}!`;
    footerGenerated = `This is a computer generated offer, no signature required.`;
  } else if (docType === 'chalan') {
    footerThankYou = `Thank you for choosing ${brandName}!`;
    footerGenerated = `This is a computer generated delivery challan, no signature required.`;
  } else if (docType === 'supplier-bill') {
    footerThankYou = `Thank you for your business!`;
    footerGenerated = `This is a computer generated purchase bill, no signature required.`;
  }

  const clientName = bill.clientName || bill.supplier?.name || "N/A";
  const clientAddress = bill.clientAddress || bill.supplier?.companyName || "";
  const formattedClientAddress = clientAddress ? clientAddress.replace(/(\b[A-Za-z]+)\s+(\d{4,5}\b)/g, '$1&nbsp;$2') : "";
  const clientPhone = bill.clientPhone || bill.supplier?.phone || "";

  const amountToConvert = docType === 'bill' || docType === 'supplier-bill' ? Math.round(bill.gTotal || bill.total || 0) : Math.round(bill.total || 0);

  const safeBrandName = JSON.stringify(brandName);
  const safeTitle = JSON.stringify(title);
  const safeInvoiceId = JSON.stringify(invoiceId);

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>${title} #${invoiceId}</title>
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Bengali:wght@400;600;700&family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
        <style>
          :root {
            --primary: ${primary};
            --primary-foreground: ${primaryForeground};
            --border: ${border};
            --muted-foreground: ${mutedForeground};
            --foreground: ${foreground};
            --background: ${background};
          }
          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body {
            font-family: 'Inter', 'Noto Sans Bengali', -apple-system, BlinkMacSystemFont, sans-serif;
            margin: 0;
            padding: 0;
            color: var(--foreground);
            background-color: #f1f5f9;
            font-size: 12.5px;
            line-height: 1.45;
          }
          .no-print {
            position: sticky;
            top: 0;
            z-index: 9999;
            background: #ffffff;
            border-bottom: 1px solid #e2e8f0;
            padding: 12px 24px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            box-shadow: 0 1px 3px rgba(0,0,0,0.08);
          }

          /* ── Paged Layout ── */
          #pages-container {
            padding: 24px 0 40px 0;
          }
          .print-page {
            width: 210mm;
            min-height: 297mm;
            box-sizing: border-box;
            margin: 0 auto 24px auto;
            background: #ffffff;
            padding: 10mm 10mm 10mm 10mm;
            box-shadow: 0 4px 14px rgba(0, 0, 0, 0.08);
            border: 1px solid #e2e8f0;
            border-radius: 4px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            page-break-after: always;
            break-after: page;
            page-break-inside: avoid;
            break-inside: avoid;
            position: relative;
          }
          .print-page:last-child {
            page-break-after: avoid;
            break-after: avoid;
            margin-bottom: 0;
          }
          .page-content {
            flex: 1;
            display: block;
          }

          /* ── Page 1 Full Header ── */
          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid var(--border);
            padding-bottom: 10px;
            margin-bottom: 10px;
            gap: 20px;
          }
          .brand-logo-container {
            display: flex;
            flex-direction: column;
            flex: 1;
            min-width: 0;
          }
          .header-brand-logo {
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            justify-content: flex-start;
            flex-shrink: 0;
          }
          .brand-logo-img {
            height: 125px;
            max-height: 135px;
            max-width: 250px;
            object-fit: contain;
            display: block;
          }
          .brand-logo {
            font-size: 15.5px;
            font-weight: 700;
            color: var(--primary);
            text-transform: uppercase;
            margin-bottom: 3px;
            letter-spacing: 0.05em;
          }
          .brand-details {
            font-size: 11px;
            color: var(--muted-foreground);
            line-height: 1.35;
          }
          .bill-title {
            font-size: 28px;
            font-weight: 800;
            color: var(--foreground);
            margin: 0 0 3px 0;
            letter-spacing: -0.025em;
            text-transform: uppercase;
          }
          .details-grid {
            display: flex;
            justify-content: space-between;
            margin-bottom: 12px;
          }
          .bill-to, .bill-info {
            width: 48%;
          }
          .bill-to h3, .bill-info h3 {
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            margin: 0 0 4px 0;
            color: var(--muted-foreground);
            letter-spacing: 0.03em;
          }
          .bill-to p, .bill-info p {
            margin: 2px 0;
            font-size: 12px;
          }
          .info-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 2px;
            font-size: 12px;
          }
          .info-label {
            font-weight: 600;
            color: var(--muted-foreground);
          }

          /* ── Subsequent Pages Compact Header ── */
          .page-header {
            width: 48%;
            max-width: 48%;
            box-sizing: border-box;
            margin-bottom: 12px;
          }
          .page-header-brand {
            display: flex;
            flex-direction: column;
            text-align: left;
            width: 100%;
          }
          .page-header-title {
            font-size: 13px;
            font-weight: 800;
            color: var(--primary);
            text-transform: uppercase;
            letter-spacing: 0.05em;
            margin-bottom: 3px;
          }
          .page-header-lines {
            display: flex;
            flex-direction: column;
            gap: 2px;
          }
          .page-header-line {
            font-size: 12px;
            color: var(--foreground);
            line-height: 1.4;
          }
          .page-header-line strong {
            color: var(--foreground);
            font-weight: 600;
          }

          /* ── Table Styling ── */
          table.invoice-table {
            width: 100%;
            border-collapse: collapse;
            margin: 0;
          }
          th.col-header {
            background-color: var(--primary) !important;
            color: var(--primary-foreground) !important;
            text-align: left;
            padding: 6px 8px !important;
            font-size: 11px !important;
            font-weight: 700 !important;
            text-transform: uppercase !important;
            letter-spacing: 0.05em !important;
            border-top: 1px solid var(--border) !important;
            border-bottom: 2px solid var(--border) !important;
          }
          td {
            padding: 4px 8px;
            vertical-align: top;
            font-size: 11.5px;
            border: none;
          }
          .text-right { text-align: right; }
          .text-center { text-align: center; }

          .item-main-row td {
            border-top: 1px solid #e2e8f0;
            padding-top: 5px;
            padding-bottom: 2px;
            font-weight: 500;
          }
          .item-desc-row td {
            padding-top: 1px;
            padding-bottom: 1px;
            color: var(--muted-foreground);
            font-size: 10.5px;
            line-height: 1.35;
          }
          .item-last-row td {
            border-bottom: 1px solid #e2e8f0;
            padding-bottom: 5px;
          }

          /* ── Totals, Terms, Footer ── */
          .totals-container {
            display: flex;
            justify-content: flex-end;
            margin-top: 10px;
            margin-bottom: 10px;
          }
          .totals-box {
            width: 320px;
          }
          .total-row {
            display: flex;
            justify-content: space-between;
            padding: 3px 0;
            font-size: 12px;
          }
          .total-row.highlight {
            font-weight: 600;
            color: var(--foreground);
          }
          .total-row.grand-total {
            border-top: 2px solid var(--border);
            font-size: 13.5px;
            font-weight: 700;
            padding-top: 5px;
          }
          .terms-container {
            margin-top: 8px;
            margin-bottom: 10px;
            font-size: 11.5px;
          }
          .footer {
            text-align: center;
            font-size: 10.5px;
            color: var(--muted-foreground);
          }

          /* ── Seal & Signature at Bottom of Each Page ── */
          .page-sign-section {
            display: flex;
            justify-content: flex-end;
            align-items: flex-end;
            margin-top: auto;
            padding-top: 8px;
            padding-bottom: 6px;
          }
          .page-sign-box {
            display: flex;
            flex-direction: column;
            align-items: center;
            text-align: center;
            min-width: 140px;
          }
          .page-sign-img {
            height: 52px;
            max-width: 130px;
            object-fit: contain;
            display: block;
            margin-bottom: 2px;
            mix-blend-mode: multiply;
          }
          .page-sign-label {
            font-size: 10.5px;
            font-weight: 600;
            color: var(--muted-foreground);
            border-top: 1px dashed #cbd5e1;
            padding-top: 3px;
            width: 100%;
            letter-spacing: 0.02em;
          }

          /* ── Bottom Page Bar ── */
          .page-bottom-bar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 11px;
            color: #64748b;
            border-top: 1px solid #cbd5e1;
            padding-top: 6px;
            margin-top: auto;
          }
          .page-num-placeholder {
            font-weight: 700;
            color: var(--foreground);
            font-size: 11.5px;
            letter-spacing: 0.02em;
          }

          /* ═══════════════ PRINT MEDIA ═══════════════ */
          @media print {
            @page {
              size: A4 portrait;
              margin: 10mm 10mm 10mm 10mm;
            }
            .no-print {
              display: none !important;
            }
            body {
              padding: 0 !important;
              margin: 0 !important;
              background: #ffffff !important;
            }
            #pages-container {
              padding: 0 !important;
              margin: 0 !important;
            }
            .print-page {
              width: 100% !important;
              max-width: 100% !important;
              height: 274mm !important;
              min-height: 274mm !important;
              max-height: 274mm !important;
              margin: 0 !important;
              padding: 0 !important;
              border: none !important;
              box-shadow: none !important;
              border-radius: 0 !important;
              display: flex !important;
              flex-direction: column !important;
              justify-content: space-between !important;
              page-break-after: always !important;
              break-after: page !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
            .print-page:last-child {
              page-break-after: avoid !important;
              break-after: avoid !important;
            }
            .page-content {
              flex: 1 !important;
              display: block !important;
            }
            .page-bottom-bar {
              margin-top: auto !important;
            }
          }
        </style>
      </head>
      <body>
        <!-- Top Toolbar for Screen View -->
        <div class="no-print">
          <div style="font-weight: 600; font-size: 14px; color: #1e293b; display: flex; align-items: center; gap: 8px;">
            <span>${title} #${invoiceId}</span>
          </div>
          <div style="display: flex; gap: 10px;">
            <button onclick="window.print()" style="cursor: pointer; background-color: ${primary}; color: ${primaryForeground}; border: none; padding: 8px 18px; border-radius: 6px; font-weight: 600; font-size: 13px; display: flex; align-items: center; gap: 6px; box-shadow: 0 1px 2px rgba(0,0,0,0.1);">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
              Print / Save PDF
            </button>
            <button onclick="window.close()" style="cursor: pointer; background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; padding: 8px 16px; border-radius: 6px; font-weight: 500; font-size: 13px;">
              Close
            </button>
          </div>
        </div>

        <!-- SOURCE TEMPLATES (Hidden, measured and cloned into physical pages) -->
        <div id="source-templates" style="display: none;">
          <!-- Template: Page 1 Full Document Header -->
          <div id="tpl-doc-header">
            <div class="header">
              <div class="brand-logo-container">
                <h1 class="bill-title">${title}</h1>
                <div class="brand-logo">${brandName}</div>
                <div class="brand-details">
                  ${brandAddress ? `<div>${brandAddress}</div>` : ''}
                  <div>${brandEmail ? `Email: ${brandEmail}` : ''}${brandEmail && brandPhone ? ' | ' : ''}${brandPhone ? `Phone: ${brandPhone}` : ''}</div>
                </div>
              </div>
              <div class="header-brand-logo">
                <img src="${finalLogoUrl}" alt="${brandName}" class="brand-logo-img" />
              </div>
            </div>

            <div class="details-grid">
              <div class="bill-to">
                <h3>${labelTo}</h3>
                <p><strong>${clientName}</strong></p>
                ${clientAddress ? `<p>Address: ${formattedClientAddress}</p>` : ''}
                ${clientPhone ? `<p>Phone: ${clientPhone}</p>` : ''}
                ${bill.clientEmail ? `<p>Email: ${bill.clientEmail}</p>` : ''}
              </div>
              <div class="bill-info">
                <h3>Document Info</h3>
                <div class="info-row">
                  <span class="info-label">${labelNo}</span>
                  <span>${invoiceId}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Date</span>
                  <span>${formattedDate}</span>
                </div>
                ${docType === 'bill' ? `
                  <div class="info-row">
                    <span class="info-label">Status</span>
                    <span>${bill.status || "Pending"}</span>
                  </div>
                  ${bill.status === 'Due' && bill.expectedReceivableDate ? `
                    <div class="info-row">
                      <span class="info-label">Expected Date</span>
                      <span>${format(new Date(bill.expectedReceivableDate), "dd MMM yyyy")}</span>
                    </div>
                  ` : ''}
                ` : ''}
                ${docType === 'offer' && bill.expectedDeliveryDate ? `
                  <div class="info-row">
                    <span class="info-label">Exp. Delivery</span>
                    <span>${format(new Date(bill.expectedDeliveryDate), "dd MMM yyyy")}</span>
                  </div>
                ` : ''}
              </div>
            </div>
          </div>

          <!-- Template: Subsequent Pages Compact Header -->
          <div id="tpl-page-header">
            <div class="page-header">
              <div class="page-header-brand">
                <div class="page-header-title">${brandName}</div>
                <div class="page-header-lines">
                  <div class="page-header-line">
                    <span>${title} <strong>#${invoiceId}</strong></span>
                  </div>
                  <div class="page-header-line">
                    <span>${docType === 'supplier-bill' ? 'Supplier:' : 'Client:'} <strong>${clientName}</strong></span>
                  </div>
                  ${clientAddress ? `
                    <div class="page-header-line">
                      <span>Address: ${formattedClientAddress}</span>
                    </div>
                  ` : ''}
                  <div class="page-header-line">
                    <span>Date: <strong>${formattedDate}</strong></span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Template: Table Structure with Column Headers -->
          <table id="tpl-table" class="invoice-table">
            <thead>
              <tr class="table-columns-tr">
                <th style="width: 40px;" class="col-header text-center">#</th>
                <th class="col-header">Title/Description</th>
                <th class="col-header text-center" style="width: 70px;">Qty</th>
                ${docType !== 'chalan' ? `
                  <th class="col-header text-right" style="width: 110px;">Rate</th>
                  <th class="col-header text-right" style="width: 120px;">Amount</th>
                ` : ''}
              </tr>
            </thead>
            <tbody id="source-tbody">
              ${items.map((item: any, index: number) => {
                const descLines = getDescriptionLines(item.description);
                const hasDesc = descLines.length > 0;
                const isChalan = docType === 'chalan';

                let rowHtml = `
                  <tr class="item-main-row ${!hasDesc ? 'item-last-row' : ''}">
                    <td class="text-center" style="font-weight: 600;">${index + 1}</td>
                    <td style="font-weight: 600;">${item.name || ""}</td>
                    <td class="text-center">${item.quantity || 1}</td>
                    ${!isChalan ? `
                      <td class="text-right">&#2547;${Math.round(item.price || 0)}</td>
                      <td class="text-right">&#2547;${Math.round((item.price || 0) * (item.quantity || 1))}</td>
                    ` : ''}
                  </tr>
                `;

                descLines.forEach((line, lineIdx) => {
                  const isLast = lineIdx === descLines.length - 1;
                  rowHtml += `
                    <tr class="item-desc-row ${isLast ? 'item-last-row' : ''}">
                      <td></td>
                      <td>${line}</td>
                      <td></td>
                      ${!isChalan ? `
                        <td></td>
                        <td></td>
                      ` : ''}
                    </tr>
                  `;
                });

                return rowHtml;
              }).join('')}
            </tbody>
          </table>

          <!-- Template: Totals, Terms, and Footer -->
          <div id="tpl-totals">
            ${docType !== 'chalan' ? `
              <div class="totals-container">
                <div class="totals-box">
                  <div class="total-row">
                    <span>Subtotal:</span>
                    <span>&#2547;${Math.round(bill.subtotal || 0)}</span>
                  </div>
                  ${bill.deliveryCharge > 0 ? `
                    <div class="total-row">
                      <span>Delivery Charge:</span>
                      <span>&#2547;${Math.round(bill.deliveryCharge)}</span>
                    </div>
                  ` : ''}
                  ${bill.serviceFee > 0 ? `
                    <div class="total-row">
                      <span>Service Fee:</span>
                      <span>&#2547;${Math.round(bill.serviceFee)}</span>
                    </div>
                  ` : ''}
                  ${bill.discount > 0 ? `
                    <div class="total-row" style="color: var(--primary);">
                      <span>${bill.discountType === 'percentage' ? `Discount (${bill.discountValue}%):` : 'Discount:'}</span>
                      <span>- &#2547;${Math.round(bill.discount)}</span>
                    </div>
                  ` : ''}
                  <div class="total-row highlight">
                    <span>Total:</span>
                    <span>&#2547;${Math.round(bill.total || 0)}</span>
                  </div>
                  ${docType === 'bill' ? `
                    ${bill.prevDue > 0 ? `
                      <div class="total-row">
                        <span>Previous Due:</span>
                        <span>&#2547;${Math.round(bill.prevDue)}</span>
                      </div>
                    ` : ''}
                    <div class="total-row grand-total">
                      <span>Grand Total:</span>
                      <span>&#2547;${Math.round(bill.gTotal || 0)}</span>
                    </div>
                    <div class="total-row">
                      <span>Paid Amount:</span>
                      <span>&#2547;${Math.round(bill.cashIn || 0)}</span>
                    </div>
                    <div class="total-row highlight" style="${bill.currentBillDue > 0 ? 'color: #ef4444;' : 'color: var(--primary);'}">
                      <span>Remaining Due:</span>
                      <span>&#2547;${Math.round(bill.currentBillDue || 0)}</span>
                    </div>
                  ` : ''}
                </div>
              </div>

              <div class="terms-container">
                <div>
                  <strong>Amount in Words:</strong> ${numberToWords(amountToConvert)} Taka Only ${bill.vatTaxIncluded !== undefined ? `(${bill.vatTaxIncluded ? 'VAT & Tax Included' : 'VAT & Tax Excluded'})` : ''}
                </div>
                ${bill.termsAndConditions ? `
                  <div style="margin-top: 6px;">
                    <strong>Terms &amp; Conditions:</strong>
                    <div style="white-space: pre-wrap; font-style: italic; color: #555; margin-top: 3px;">${bill.termsAndConditions}</div>
                  </div>
                ` : ''}
              </div>

              <div class="footer">
              </div>
            ` : `
              <div class="footer">
              </div>
            `}
          </div>
        </div>

        <!-- TARGET CONTAINER FOR RENDERED PAGES -->
        <div id="pages-container"></div>

        <script>
          function paginateDocument() {
            var container = document.getElementById('pages-container');
            if (!container || container.children.length > 0) return;

            var docHeaderTpl = document.getElementById('tpl-doc-header');
            var pageHeaderTpl = document.getElementById('tpl-page-header');
            var tableTpl = document.getElementById('tpl-table');
            var totalsTpl = document.getElementById('tpl-totals');
            var sourceRows = Array.from(document.querySelectorAll('#source-tbody tr'));

            // Optimal printable height per A4 page (~905px considering bottom signature and footer)
            var MAX_PAGE_HEIGHT = 905;

            var currentPageIndex = 1;
            var currentPageDiv = null;
            var currentTableBody = null;
            var currentContentDiv = null;

            function createNewPage() {
              var page = document.createElement('div');
              page.className = 'print-page';

              var content = document.createElement('div');
              content.className = 'page-content';
              page.appendChild(content);

              // Attach Header: Full header identical to first page on all pages
              content.appendChild(docHeaderTpl.cloneNode(true));

              // Attach Table with Column Headers
              var table = tableTpl.cloneNode(false);
              var thead = tableTpl.querySelector('thead').cloneNode(true);
              table.appendChild(thead);
              var tbody = document.createElement('tbody');
              table.appendChild(tbody);
              content.appendChild(table);

              // Signature & Seal Watermark Section right before bottom bar on every page
              var signSection = document.createElement('div');
              signSection.className = 'page-sign-section';
              signSection.innerHTML = '<div class="page-sign-box">' +
                '<img src="' + ${JSON.stringify(finalSignUrl)} + '" alt="Seal & Signature" class="page-sign-img" />' +
                '<div class="page-sign-label">Authorized Signature</div>' +
                '</div>';
              page.appendChild(signSection);

              // Bottom Page Bar
              var bottomBar = document.createElement('div');
              bottomBar.className = 'page-bottom-bar';
              var footerNote = ${JSON.stringify(footerGenerated)};
              bottomBar.innerHTML = '<span style="font-style: italic;">' + footerNote + '</span><span class="page-num-placeholder"></span>';
              page.appendChild(bottomBar);

              container.appendChild(page);

              currentPageDiv = page;
              currentContentDiv = content;
              currentTableBody = tbody;
              currentPageIndex++;
              return page;
            }

            function getPageContentHeight() {
              var h = 0;
              var children = currentContentDiv.children;
              for (var i = 0; i < children.length; i++) {
                h += children[i].offsetHeight || 0;
              }
              return h;
            }

            createNewPage();

            // Distribute rows across physical pages
            sourceRows.forEach(function(row) {
              var rowClone = row.cloneNode(true);
              currentTableBody.appendChild(rowClone);

              if (getPageContentHeight() > MAX_PAGE_HEIGHT && currentTableBody.children.length > 1) {
                currentTableBody.removeChild(rowClone);
                createNewPage();
                currentTableBody.appendChild(rowClone);
              }
            });

            // Append Totals, Terms, and Footer
            if (totalsTpl) {
              var totalsClone = totalsTpl.cloneNode(true);
              currentContentDiv.appendChild(totalsClone);

              if (getPageContentHeight() > MAX_PAGE_HEIGHT && currentTableBody.children.length > 0) {
                currentContentDiv.removeChild(totalsClone);
                createNewPage();
                var emptyTable = currentContentDiv.querySelector('table');
                if (emptyTable) emptyTable.style.display = 'none';
                currentContentDiv.appendChild(totalsClone);
              }
            }

            // Update all page numbers (Page 1 of X, Page 2 of X, etc.)
            var allPages = document.querySelectorAll('.print-page');
            var totalPages = allPages.length;
            allPages.forEach(function(p, idx) {
              var numElem = p.querySelector('.page-num-placeholder');
              if (numElem) {
                numElem.textContent = 'Page ' + (idx + 1) + ' of ' + totalPages;
              }
            });
          }

          var hasPrinted = false;
          function doPrint() {
            if (hasPrinted) return;
            hasPrinted = true;
            try {
              window.focus();
              window.print();
            } catch (err) {
              console.error('Print error:', err);
            }
          }

          function init() {
            var signPreload = new Image();
            signPreload.src = ${JSON.stringify(finalSignUrl)};
            var logo = document.querySelector('.brand-logo-img');

            var pending = [];
            if (logo && !logo.complete) pending.push(logo);
            if (!signPreload.complete) pending.push(signPreload);

            if (pending.length > 0) {
              var count = 0;
              var onDone = function() {
                count++;
                if (count >= pending.length) {
                  paginateDocument();
                  schedulePrint();
                }
              };
              pending.forEach(function(img) {
                img.onload = onDone;
                img.onerror = onDone;
              });
            } else {
              paginateDocument();
              schedulePrint();
            }
          }

          function schedulePrint() {
            if (document.fonts && document.fonts.ready) {
              document.fonts.ready.then(function() {
                setTimeout(doPrint, 350);
              });
            } else {
              setTimeout(doPrint, 600);
            }
            setTimeout(doPrint, 1200);
          }

          if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
          } else {
            init();
          }
        </script>
      </body>
    </html>
  `;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  } else {
    toast.error('Pop-up was blocked. Please allow pop-ups for this website to print/view PDF.');
  }
}

/**
 * Generates a professional Money / Payment Receipt popup for a client bill.
 * Shows client info, purchased items, grand total, amount received this payment,
 * and remaining due balance.
 */
export async function generatePaymentReceiptPDF(
  bill: any,
  settings: any,
  paymentAmount?: number,
  customReceiptDate?: string | Date,
  txId?: string,
  isInitialBill?: boolean
) {
  const brandName = settings?.brandName || 'Inflation Engineering';
  const brandEmail = settings?.contact?.email || '';
  const brandPhone = settings?.contact?.phone || '';
  const brandAddress = settings?.contact?.address || '';

  let primary = '#00D1B2';
  let primaryForeground = '#ffffff';
  let border = '#e2e8f0';
  let mutedForeground = '#64748b';
  let foreground = '#0f172a';

  if (typeof window !== 'undefined') {
    const rootStyle = getComputedStyle(document.documentElement);
    const getColor = (varName: string, fallback: string) => {
      const val = rootStyle.getPropertyValue(varName).trim();
      if (!val) return fallback;
      if (val.startsWith('#') || val.startsWith('rgb') || val.startsWith('hsl') || val.startsWith('oklch') || val.includes('(')) return val;
      return `hsl(${val})`;
    };
    primary = getColor('--primary', primary);
    primaryForeground = getColor('--primary-foreground', primaryForeground);
    border = getColor('--border', border);
    mutedForeground = getColor('--muted-foreground', mutedForeground);
    foreground = getColor('--foreground', foreground);
  }

  const getAbsoluteUrl = (url: string) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) return url;
    if (typeof window !== 'undefined') {
      return `${window.location.origin}${url.startsWith('/') ? '' : '/'}${url}`;
    }
    return url;
  };
  const brandLogoUrl = settings?.logoUrl || settings?.logo || '/logo.webp';
  const finalLogoUrl = getAbsoluteUrl(brandLogoUrl);
  const finalSignUrl = getAbsoluteUrl('/assets/sign.png');

  const invoiceId = String(bill.invoiceNo || bill._id || '').toUpperCase();
  const billDate = bill.date ? new Date(bill.date) : new Date();
  const formattedDate = isValid(billDate) ? format(billDate, 'dd MMM yyyy') : 'N/A';
  const parsedReceiptDate = customReceiptDate ? new Date(customReceiptDate) : new Date();
  const receiptDate = isValid(parsedReceiptDate) ? format(parsedReceiptDate, 'dd MMM yyyy') : format(new Date(), 'dd MMM yyyy');

  const items: any[] = Array.isArray(bill.items) ? bill.items : [];
  const grandTotal = Math.round(bill.gTotal || bill.total || 0);
  const prevDue = Math.round(bill.prevDue || 0);
  const billTotal = Math.round(bill.total || 0);

  // Analyze payment history list if available
  const payments: any[] = Array.isArray(bill.payments) ? bill.payments : [];

  let thisPayment = 0;
  let previouslyPaid = 0;
  let totalPaid = 0;
  let remainingDue = 0;

  if (isInitialBill) {
    // Initial stage when bill was created: 0 received, 100% full due
    thisPayment = 0;
    previouslyPaid = 0;
    totalPaid = 0;
    remainingDue = grandTotal;
  } else if (payments.length > 0) {
    // Attempt to locate target transaction by ID or by matching amount & date
    let matchedIdx = -1;
    if (txId) {
      matchedIdx = payments.findIndex(p => p._id?.toString() === txId.toString());
    }
    if (matchedIdx === -1 && paymentAmount !== undefined && paymentAmount > 0) {
      matchedIdx = payments.findIndex(p => Math.round(p.amount) === Math.round(paymentAmount));
    }

    if (matchedIdx !== -1) {
      // All payments before this one
      previouslyPaid = payments.slice(0, matchedIdx).reduce((acc, p) => acc + Math.round(p.amount || 0), 0);
      thisPayment = Math.round(payments[matchedIdx].amount || thisPayment);
      totalPaid = previouslyPaid + thisPayment;
      remainingDue = Math.max(0, grandTotal - totalPaid);
    } else {
      // Fallback if not matched in array
      thisPayment = Math.round(paymentAmount !== undefined ? paymentAmount : (bill.cashIn || 0));
      totalPaid = Math.round(bill.cashIn || thisPayment);
      previouslyPaid = Math.max(0, totalPaid - thisPayment);
      remainingDue = Math.max(0, grandTotal - totalPaid);
    }
  } else {
    // No payments list attached
    if (paymentAmount !== undefined) {
      thisPayment = Math.round(paymentAmount);
      // If upfront payment (e.g. 20,000 on 30,000 bill)
      if (thisPayment < grandTotal && (!bill.cashIn || bill.cashIn === thisPayment)) {
        previouslyPaid = 0;
        totalPaid = thisPayment;
        remainingDue = Math.max(0, grandTotal - totalPaid);
      } else {
        totalPaid = Math.round(bill.cashIn || thisPayment);
        previouslyPaid = Math.max(0, totalPaid - thisPayment);
        remainingDue = Math.max(0, grandTotal - totalPaid);
      }
    } else {
      thisPayment = Math.round(bill.cashIn || 0);
      totalPaid = thisPayment;
      previouslyPaid = 0;
      remainingDue = Math.max(0, grandTotal - totalPaid);
    }
  }

  const dueBeforePayment = Math.max(0, grandTotal - previouslyPaid);
  const amountInWords = thisPayment > 0 ? `${numberToWords(thisPayment)} Taka Only` : 'Zero Taka (Initial Due Stage)';

  const itemRows = items.map((item: any, idx: number) => {
    const descLines = getDescriptionLines(item.description);
    const hasDesc = descLines.length > 0;

    let rowHtml = `
      <tr class="item-main-row" style="border-top:1px solid ${border};${!hasDesc ? `border-bottom:1px solid ${border};` : ''}">
        <td style="padding:6px 8px;color:${mutedForeground};font-size:11px;vertical-align:top;">${idx + 1}</td>
        <td style="padding:6px 8px;font-weight:600;font-size:12px;vertical-align:top;">${item.name || ''}</td>
        <td style="padding:6px 8px;text-align:center;font-size:12px;vertical-align:top;">${item.quantity || 1}</td>
        <td style="padding:6px 8px;text-align:right;font-size:12px;vertical-align:top;">৳${Math.round(item.price || 0).toLocaleString()}</td>
        <td style="padding:6px 8px;text-align:right;font-size:12px;font-weight:600;vertical-align:top;">৳${Math.round((item.price || 0) * (item.quantity || 1)).toLocaleString()}</td>
      </tr>
    `;

    descLines.forEach((line: string, lineIdx: number) => {
      const isLast = lineIdx === descLines.length - 1;
      rowHtml += `
        <tr class="item-desc-row" style="${isLast ? `border-bottom:1px solid ${border};` : ''}">
          <td></td>
          <td style="padding:1px 8px 3px 8px;color:${mutedForeground};font-size:10.5px;line-height:1.4;">${line}</td>
          <td></td>
          <td></td>
          <td></td>
        </tr>
      `;
    });

    return rowHtml;
  }).join('');

  const deliveryCharge = Math.round(bill.deliveryCharge || 0);
  const serviceFee = Math.round(bill.serviceFee || 0);
  const discount = Math.round(bill.discount || 0);

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Money Receipt - ${invoiceId}</title>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Bengali:wght@400;600;700&family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body {
      font-family: 'Inter', 'Noto Sans Bengali', sans-serif;
      margin: 0; padding: 0;
      background: #f1f5f9;
      color: ${foreground};
      font-size: 12.5px;
    }
    .no-print {
      position: sticky; top: 0; z-index: 999;
      background: #fff; border-bottom: 1px solid ${border};
      padding: 10px 24px;
      display: flex; justify-content: space-between; align-items: center;
      box-shadow: 0 1px 4px rgba(0,0,0,0.07);
    }
    .no-print h3 { margin: 0; font-size: 15px; color: ${foreground}; }
    .no-print button {
      padding: 7px 20px; border-radius: 6px; border: none;
      background: ${primary}; color: ${primaryForeground};
      font-size: 13px; font-weight: 600; cursor: pointer;
    }
    .page-wrap { padding: 28px 0 40px 0; }
    .receipt-card {
      width: 190mm;
      margin: 0 auto;
      background: #fff;
      border: 1px solid ${border};
      border-radius: 8px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.08);
    }

    /* Header */
    .receipt-header {
      display: flex; justify-content: space-between; align-items: center;
      padding: 14px 20px 12px 20px;
      border-bottom: 3px solid ${primary};
      background: linear-gradient(135deg, ${primary}12 0%, transparent 60%);
      gap: 16px;
    }
    .receipt-logo-container {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      flex-shrink: 0;
    }
    .receipt-logo-img {
      height: 100px;
      max-height: 115px;
      max-width: 220px;
      object-fit: contain;
      display: block;
    }

    .brand-name { font-size: 16px; font-weight: 800; color: ${primary}; letter-spacing: 0.04em; text-transform: uppercase; }
    .brand-sub { font-size: 11px; color: ${mutedForeground}; line-height: 1.4; margin-top: 2px; }

    /* Client & Bill Info */
    .info-row {
      display: grid; grid-template-columns: 1fr 1fr;
      gap: 0; border-bottom: 1px solid ${border};
    }
    .info-block { padding: 12px 20px; }
    .info-block + .info-block { border-left: 1px solid ${border}; }
    .info-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: ${mutedForeground}; margin-bottom: 5px; }
    .info-value { font-size: 13px; font-weight: 700; color: ${foreground}; }
    .info-small { font-size: 10.5px; color: ${mutedForeground}; margin-top: 2px; }

    .receipt-title { font-size: 20px; font-weight: 900; color: ${primary}; letter-spacing: -0.02em; text-transform: uppercase; margin: 0; }
    .receipt-sub { font-size: 10px; color: ${mutedForeground}; margin-top: 1px; }
    .receipt-meta { font-size: 11px; color: ${foreground}; margin-top: 5px; }
    .receipt-meta span { font-weight: 700; }

    /* Items Table */
    .items-section { padding: 0 20px 10px 20px; }
    .items-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: ${mutedForeground}; padding: 12px 0 6px 0; }
    .items-table { width: 100%; border-collapse: collapse; font-size: 12px; }
    .items-table thead th {
      background: ${primary}18;
      color: ${mutedForeground};
      font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em;
      padding: 6px 8px; text-align: left; border-bottom: 2px solid ${primary}40;
    }
    .items-table thead th:nth-child(3),
    .items-table thead th:nth-child(4),
    .items-table thead th:nth-child(5) { text-align: right; }
    .item-desc-row td p { margin: 2px 0; }
    .item-desc-row td ul { margin: 2px 0; padding-left: 16px; list-style: disc; }
    .item-desc-row td ol { margin: 2px 0; padding-left: 16px; list-style: decimal; }
    .item-desc-row td li { margin: 1px 0; }
    .item-desc-row td blockquote { border-left: 2px solid ${border}; padding-left: 6px; margin: 2px 0; }

    /* Totals */
    .bill-summary-container {
      display: flex; justify-content: flex-end;
      padding: 4px 20px 12px 20px;
    }
    .bill-summary-box {
      width: 270px;
      border: 1px solid ${border};
      border-radius: 6px;
      padding: 8px 12px;
      background: #fafafa;
    }

    /* Payment Banner */
    .payment-banner {
      margin: 0 20px 16px 20px;
      background: ${primary};
      color: ${primaryForeground};
      border-radius: 8px;
      padding: 12px 18px;
      display: flex; justify-content: space-between; align-items: center;
    }
    .payment-banner .left-side .label { font-size: 10px; font-weight: 600; opacity: 0.85; text-transform: uppercase; letter-spacing: 0.06em; }
    .payment-banner .left-side .amount { font-size: 22px; font-weight: 900; letter-spacing: -0.02em; margin-top: 2px; }
    .payment-banner .left-side .words { font-size: 9.5px; opacity: 0.8; margin-top: 3px; }
    .payment-banner .right-side { text-align: right; }
    .payment-banner .right-side .due-label { font-size: 9px; opacity: 0.8; text-transform: uppercase; letter-spacing: 0.06em; }
    .payment-banner .right-side .due-amount { font-size: 16px; font-weight: 800; margin-top: 2px; }
    .due-zero { opacity: 0.7; }

    /* Footer */
    .receipt-footer {
      padding: 10px 20px 14px 20px;
      border-top: 1px solid ${border};
      display: flex; justify-content: space-between; align-items: flex-end;
      font-size: 10px; color: ${mutedForeground};
    }
    .sig-line { width: 130px; border-top: 1.5px solid ${foreground}; padding-top: 4px; text-align: center; font-size: 10px; color: ${foreground}; margin-top: 30px; }
    .stamp-circle {
      width: 70px; height: 70px; border-radius: 50%;
      border: 2px dashed ${primary}60;
      display: flex; align-items: center; justify-content: center;
      color: ${primary}80; font-size: 9px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.05em; text-align: center;
    }
    .watermark {
      position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-35deg);
      font-size: 56px; font-weight: 900; opacity: 0.045;
      color: ${primary}; text-transform: uppercase; letter-spacing: 0.1em;
      pointer-events: none; white-space: nowrap; z-index: 0;
    }

    @media print {
      @page {
        size: auto;
        margin: 8mm 8mm 8mm 8mm;
      }
      .no-print { display: none !important; }
      body { background: #fff !important; }
      .page-wrap { padding: 0 !important; }
      .receipt-card {
        box-shadow: none !important;
        border: none !important;
        width: 100% !important;
        border-radius: 0 !important;
        overflow: visible !important;
        page-break-inside: auto !important;
      }
      .items-table thead {
        display: table-header-group;
      }
      tr {
        page-break-inside: avoid;
        break-inside: avoid;
      }
      .payment-banner, .receipt-footer, .bill-summary-container, .info-row, .receipt-header {
        page-break-inside: avoid;
        break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <div class="no-print">
    <h3>Money / Payment Receipt</h3>
    <button onclick="window.print()">Print Receipt</button>
  </div>

  <div class="page-wrap">
    <div class="receipt-card" style="position:relative;">
      <div class="watermark">Receipt</div>

      <!-- Header: Left Brand Info, Right Branding Logo -->
      <div class="receipt-header">
        <div>
          <div class="brand-name">${brandName}</div>
          <div class="brand-sub">
            ${brandAddress ? brandAddress + '<br>' : ''}
            ${brandPhone ? 'Phone: ' + brandPhone : ''} ${brandPhone && brandEmail ? '&nbsp;|&nbsp; ' : ''}${brandEmail ? 'Email: ' + brandEmail : ''}
          </div>
        </div>
        <!-- Top Right Corner Branding Logo -->
        <div class="receipt-logo-container">
          <img src="${finalLogoUrl}" alt="${brandName}" class="receipt-logo-img" />
        </div>
      </div>

      <!-- Info Row: Left = Money Receipt Meta, Right = Received From -->
      <div class="info-row">
        <!-- Left: Money Receipt Info -->
        <div class="info-block">
          <div class="receipt-title">Money Receipt</div>
          <div class="receipt-sub">Payment Acknowledgement</div>
          <div class="receipt-meta">
            <div>Bill No: <span>${invoiceId}</span></div>
            <div>Bill Date: <span>${formattedDate}</span></div>
            <div>Receipt Date: <span>${receiptDate}</span></div>
          </div>
        </div>

        <!-- Right: Received From -->
        <div class="info-block">
          <div class="info-label">Received From</div>
          <div class="info-value">${bill.clientName || 'N/A'}</div>
          ${bill.clientPhone ? `<div class="info-small">Phone: ${bill.clientPhone}</div>` : ''}
          ${bill.clientEmail ? `<div class="info-small">Email: ${bill.clientEmail}</div>` : ''}
          ${bill.clientAddress ? `<div class="info-small">Address: ${bill.clientAddress}</div>` : ''}
        </div>
      </div>

      <!-- Items Section -->
      ${items.length > 0 ? `
      <div class="items-section">
        <div class="items-label">Items / Services</div>
        <table class="items-table">
          <thead>
            <tr>
              <th style="width:30px;">#</th>
              <th>Description</th>
              <th style="width:50px;text-align:center;">Qty</th>
              <th style="width:80px;text-align:right;">Unit Price</th>
              <th style="width:90px;text-align:right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemRows}
          </tbody>
        </table>
      </div>
      ` : ''}

      <!-- Bill Summary: Under Item Table Right Corner -->
      <div class="bill-summary-container">
        <div class="bill-summary-box">
          <div class="info-label" style="margin-bottom: 5px; border-bottom: 1px solid ${border}; padding-bottom: 3px;">Bill Summary</div>
          <div style="display: flex; justify-content: space-between; font-size: 11.5px; padding: 2px 0;">
            <span style="color: ${mutedForeground};">Subtotal:</span>
            <strong>৳${Math.round(bill.subtotal || 0).toLocaleString()}</strong>
          </div>
          ${deliveryCharge > 0 ? `
          <div style="display: flex; justify-content: space-between; font-size: 11.5px; padding: 2px 0;">
            <span style="color: ${mutedForeground};">Delivery:</span>
            <strong>৳${deliveryCharge.toLocaleString()}</strong>
          </div>` : ''}
          ${serviceFee > 0 ? `
          <div style="display: flex; justify-content: space-between; font-size: 11.5px; padding: 2px 0;">
            <span style="color: ${mutedForeground};">Service Fee:</span>
            <strong>৳${serviceFee.toLocaleString()}</strong>
          </div>` : ''}
          ${discount > 0 ? `
          <div style="display: flex; justify-content: space-between; font-size: 11.5px; padding: 2px 0;">
            <span style="color: ${mutedForeground};">Discount:</span>
            <strong style="color: #ef4444;">-৳${discount.toLocaleString()}</strong>
          </div>` : ''}
          ${prevDue > 0 ? `
          <div style="display: flex; justify-content: space-between; font-size: 11.5px; padding: 2px 0;">
            <span style="color: ${mutedForeground};">Previous Due:</span>
            <strong>৳${prevDue.toLocaleString()}</strong>
          </div>` : ''}
          <div style="display: flex; justify-content: space-between; font-size: 12.5px; font-weight: 700; color: ${primary}; border-top: 1px solid ${border}; margin-top: 4px; padding-top: 4px;">
            <span>Grand Total:</span>
            <span>৳${grandTotal.toLocaleString()}</span>
          </div>
          ${previouslyPaid > 0 ? `
          <div style="display: flex; justify-content: space-between; font-size: 11px; padding: 2px 0; color: #475569;">
            <span>Previously Paid:</span>
            <strong>৳${previouslyPaid.toLocaleString()}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 11px; padding: 2px 0; color: #dc2626;">
            <span>Due Before Payment:</span>
            <strong>৳${dueBeforePayment.toLocaleString()}</strong>
          </div>` : ''}
          <div style="display: flex; justify-content: space-between; font-size: 11.5px; padding: 2px 0; border-top: 1px dashed ${border}; margin-top: 3px; padding-top: 3px;">
            <span style="color: ${primary}; font-weight: 600;">This Payment Received:</span>
            <strong style="color: ${primary};">৳${thisPayment.toLocaleString()}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 11px; padding: 2px 0;">
            <span style="color: ${mutedForeground};">Total Paid To Date:</span>
            <strong>৳${totalPaid.toLocaleString()}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 11.5px; padding: 2px 0; border-top: 1px solid ${border}; margin-top: 3px; padding-top: 3px;">
            <span style="font-weight: 600;">Remaining Due:</span>
            <strong style="${remainingDue === 0 ? 'color: #10b981;' : 'color: #ef4444;'}">
              ${remainingDue === 0 ? '৳0 (Fully Paid)' : `৳${remainingDue.toLocaleString()}`}
            </strong>
          </div>
        </div>
      </div>

      <!-- Payment Banner -->
      <div class="payment-banner">
        <div class="left-side">
          <div class="label">Amount Received (This Receipt)</div>
          <div class="amount">৳${thisPayment.toLocaleString()}</div>
          <div class="words">${amountInWords}</div>
        </div>
        <div class="right-side">
          ${remainingDue <= 0
            ? `<div class="due-label">Status</div><div class="due-amount due-zero">Fully Paid</div>`
            : `<div class="due-label">Remaining Due</div><div class="due-amount">৳${remainingDue.toLocaleString()}</div>`
          }
        </div>
      </div>

      <!-- Footer -->
      <div class="receipt-footer">
        <div>
          <div class="sig-line">Received By</div>
        </div>
        <div style="display: flex; flex-direction: column; align-items: center; text-align: center;">
          <img src="${finalSignUrl}" alt="Official Seal & Sign" style="height: 52px; max-width: 130px; object-fit: contain; display: block; margin-bottom: 2px; mix-blend-mode: multiply;" />
          <div class="sig-line" style="margin-top: 0;">Authorized Signature</div>
        </div>
        <div style="text-align: right;">
          <div class="sig-line">Client Signature</div>
        </div>
      </div>
    </div>
  </div>

  <script>
    function triggerReceiptPrint() {
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(function() {
          setTimeout(function() { window.focus(); window.print(); }, 250);
        });
      } else {
        setTimeout(function() { window.focus(); window.print(); }, 400);
      }
    }
    window.addEventListener('load', function() {
      var logo = document.querySelector('.receipt-logo-img');
      if (logo && !logo.complete) {
        logo.onload = triggerReceiptPrint;
        logo.onerror = triggerReceiptPrint;
      } else {
        triggerReceiptPrint();
      }
    });
  </script>
</body>
</html>`;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  } else {
    toast.error('Pop-up was blocked. Please allow pop-ups for this website to print receipts.');
  }
}
