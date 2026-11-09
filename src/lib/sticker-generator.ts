import { format, isValid } from 'date-fns';
import { toast } from 'sonner';

function generateBarcodeHtml(value: string): string {
  const CODE39_MAP: Record<string, string> = {
    '0': '000110100', '1': '100100001', '2': '001100001', '3': '101100000',
    '4': '000110001', '5': '100110000', '6': '001110000', '7': '000100101',
    '8': '100100100', '9': '001100100', 'A': '100001001', 'B': '001001001',
    'C': '101001000', 'D': '000011001', 'E': '100011000', 'F': '001011000',
    'G': '000001101', 'H': '100001100', 'I': '001001100', 'J': '000011100',
    'K': '100000011', 'L': '001000011', 'M': '101000010', 'N': '000010011',
    'O': '100010010', 'P': '001010010', 'Q': '000000111', 'R': '100000110',
    'S': '001000110', 'T': '000010110', 'U': '110000001', 'V': '011000001',
    'W': '111000000', 'X': '010010001', 'Y': '110010000', 'Z': '011010000',
    '-': '010000101', '.': '110000100', ' ': '011000100', '*': '010010100',
  };

  const clean = value.trim().toUpperCase().replace(/[^0-9A-Z\-\.\ ]/g, '');
  const encoded = `*${clean}*`;

  // Calculate total modules to set viewBox width
  let totalWidth = 0;
  for (const char of encoded) {
    const pat = CODE39_MAP[char] || CODE39_MAP['*'];
    for (let j = 0; j < 9; j++) {
      const isWide = pat[j] === '1';
      totalWidth += isWide ? 3 : 1;
    }
    totalWidth += 1; // Inter-character gap
  }

  let svgHtml = `<svg viewBox="0 0 ${totalWidth} 55" width="100%" height="55" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" style="width: 100%; display: block; margin: 0 auto; shape-rendering: crispEdges;" shape-rendering="crispEdges">`;
  let currentX = 0;
  for (const char of encoded) {
    const pat = CODE39_MAP[char] || CODE39_MAP['*'];
    for (let j = 0; j < 9; j++) {
      const isBar = j % 2 === 0;
      const isWide = pat[j] === '1';
      const width = isWide ? 3 : 1;
      if (isBar) {
        svgHtml += `<rect x="${currentX}" y="0" width="${width}" height="55" fill="#000000" />`;
      }
      currentX += width;
    }
    currentX += 1; // Inter-character gap
  }
  svgHtml += `</svg>`;
  return svgHtml;
}

export async function printStickerInvoice(orderOrOrders: any | any[], settings: any): Promise<void> {
  const orders = Array.isArray(orderOrOrders) ? orderOrOrders : [orderOrOrders];
  if (orders.length === 0) return;

  const storeName: string = settings?.siteName || settings?.brandName || 'Inflation Engineering';

  // Dynamic theme variables
  let primary = '#00D1B2';
  let primaryForeground = '#ffffff';
  let border = '#e2e8f0';
  let mutedForeground = '#64748b';
  let foreground = '#0f172a';
  let background = '#ffffff';
  let destructive = '#ef4444';

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
    destructive = getColor('--destructive', destructive);
  }

  const stickersHtml = orders.map((order, index) => {
    const orderId = String(order.shortId || order._id || '').slice(-8).toUpperCase();
    const createdAt = order.createdAt ? new Date(order.createdAt) : null;
    const dateStr = createdAt && isValid(createdAt) ? format(createdAt, 'dd/MM/yyyy hh:mm a') : 'N/A';
    const consignmentId: string = order.shippingDetails?.consignmentId || order.shippingDetails?.trackingId || '';
    const courierName: string = order.shippingDetails?.courierName || 'Steadfast';
    const items: any[] = Array.isArray(order.items) ? order.items : [];

    const codAmount = order.paymentStatus === 'Paid' ? 0 : Math.round(order.totalAmount);
    const trackingUrl = order.shippingDetails?.trackingUrl || `https://steadfast.com.bd/t/${consignmentId}`;
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(consignmentId)}`;

    return `
      <div class="sticker-container" style="${index < orders.length - 1 ? 'page-break-after: always; break-after: page;' : ''}">
        <div>
          <div class="top-header">RTN &gt; ${storeName} - ${orderId}</div>
          <div class="invoice-label">Invoice: #${orderId}</div>

          ${consignmentId ? `
            <div class="barcode-wrapper">
              ${generateBarcodeHtml(consignmentId)}
              <div class="barcode-text">${consignmentId}</div>
            </div>
          ` : `
            <div style="border: 1px solid var(--destructive); color: var(--destructive); padding: 4px; text-align: center; font-weight: 700; font-size: 9px; margin-bottom: 4px;">
              NO COURIER BOOKING / CONSIGNMENT ID MISSING
            </div>
          `}

          <div class="grid-container">
            <div class="qr-box">
              ${consignmentId ? `<img src="${qrCodeUrl}" alt="QR Link" />` : `<div style="font-size: 8px; text-align: center; color: #888;">No QR Code</div>`}
            </div>
            <div class="info-table" style="padding: 8px; display: flex; flex-direction: column; justify-content: center; gap: 4px;">
              <div style="font-weight: 700; font-size: 13px; color: #000000; text-transform: uppercase;">${order.shippingAddress?.fullName || 'Customer'}</div>
              <div style="font-weight: 700; font-size: 13px; color: #000000;">${order.shippingAddress?.phone || ''}</div>
              <div style="font-size: 10px; color: #333333; line-height: 1.3;">
                ${[order.shippingAddress?.street, order.shippingAddress?.city]
                  .map(part => (part || '').trim())
                  .filter(part => {
                    const lower = part.toLowerCase();
                    return lower !== 'outside dhaka' && lower !== 'inside dhaka' && part !== '';
                  })
                  .join(', ')}
              </div>
              ${codAmount > 0 ? `
                <div style="font-weight: 700; font-size: 13px; margin-top: 4px; border-top: 1px dashed #000000; padding-top: 4px; display: flex; justify-content: space-between; align-items: center;">
                  <span>COD Amount:</span>
                  <span>৳${codAmount}</span>
                </div>
              ` : `
                <div style="font-weight: 700; font-size: 11px; margin-top: 4px; border-top: 1px dashed #000000; padding-top: 4px; color: green;">
                  Paid / No COD
                </div>
              `}
            </div>
          </div>
        </div>

        <div class="items-section">
          <div style="font-weight: 700; margin-bottom: 2px;">ITEMS (${items.length}):</div>
          ${items.slice(0, 3).map(item => `
            <div class="item-line">
              <span>• ${item.name}${item.size ? ` (${item.size})` : ''}</span>
              <span style="font-weight: 700;">Qty: ${item.quantity}</span>
            </div>
          `).join('')}
          ${items.length > 3 ? `
            <div style="font-size: 8px; color: #555;">+${items.length - 3} more item(s)</div>
          ` : ''}
        </div>

        <div class="footer-brand">
          <span>Date: ${dateStr}</span>
          <span style="font-weight: 700; text-transform: uppercase;">${storeName}</span>
        </div>
      </div>
    `;
  }).join('');

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Sticker Print</title>
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Bengali:wght@400;700&family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
        <style>
          :root {
            --primary: ${primary};
            --primary-foreground: ${primaryForeground};
            --border: #000000;
            --muted-foreground: #333333;
            --foreground: #000000;
            --background: #ffffff;
            --destructive: ${destructive};
          }
          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body {
            font-family: 'Inter', 'Noto Sans Bengali', sans-serif;
            margin: 0;
            padding: 0;
            background-color: var(--background);
            color: var(--foreground);
            font-size: 11px;
            line-height: 1.25;
          }
          .sticker-container {
            width: 100mm;
            height: 100mm;
            padding: 4mm;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            border: 1px solid #000000;
            page-break-inside: avoid;
            break-inside: avoid;
          }
          .top-header {
            text-align: center;
            font-weight: 700;
            font-size: 13px;
            margin-bottom: 2px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .invoice-label {
            text-align: center;
            font-size: 11px;
            color: #333;
            margin-bottom: 4px;
          }
          .barcode-wrapper {
            text-align: center;
            margin-bottom: 4px;
          }
          .barcode-text {
            font-size: 10px;
            font-weight: 700;
            margin-top: 2px;
            letter-spacing: 1px;
          }
          .grid-container {
            display: flex;
            border: 1.5px solid #000000;
            border-radius: 4px;
            margin-bottom: 6px;
            overflow: hidden;
          }
          .qr-box {
            width: 35%;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 4px;
            border-right: 1.5px solid #000000;
            background-color: #ffffff;
          }
          .qr-box img {
            width: 100%;
            height: auto;
            max-width: 80px;
            display: block;
          }
          .info-table {
            width: 65%;
            display: flex;
            flex-direction: column;
          }
          .table-header {
            background-color: #000000;
            color: #ffffff;
            font-weight: 700;
            font-size: 11px;
            text-align: center;
            padding: 3px;
            text-transform: uppercase;
          }
          .table-row {
            display: flex;
            border-bottom: 1px solid #000000;
            font-size: 10px;
          }
          .table-row:last-child {
            border-bottom: none;
          }
          .table-cell {
            padding: 3px 5px;
            flex: 1;
          }
          .table-cell-bold {
            font-weight: 700;
          }
          .table-cell-split {
            display: flex;
            justify-content: space-between;
            width: 100%;
          }
          .recipient-details {
            font-size: 11px;
            margin-bottom: 6px;
            line-height: 1.3;
          }
          .recipient-name {
            font-weight: 700;
            font-size: 12px;
            margin-bottom: 1px;
          }
          .recipient-phone {
            font-weight: 700;
            font-size: 12px;
            margin-bottom: 2px;
          }
          .items-section {
            font-size: 9px;
            border-top: 1px dashed #000000;
            padding-top: 4px;
            margin-top: auto;
          }
          .item-line {
            display: flex;
            justify-content: space-between;
            margin-bottom: 1px;
          }
          .footer-brand {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 8px;
            color: #555555;
            margin-top: 4px;
            border-top: 1.5px solid #000000;
            padding-top: 3px;
          }
          @media print {
            .no-print {
              display: none !important;
            }
            body {
              width: 100mm;
              height: 100mm;
            }
            .sticker-container {
              width: 100mm;
              height: 100mm;
              padding: 4mm;
              border: 1px solid #000000;
            }
            @page {
              size: 100mm 100mm;
              margin: 0;
            }
          }
        </style>
      </head>
      <body>
        <div class="no-print" style="position: sticky; top: 0; z-index: 9999; background: #ffffff; border-bottom: 1px solid #e2e8f0; padding: 10px 16px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 1px 3px rgba(0,0,0,0.08); margin-bottom: 15px;">
          <div style="font-weight: 600; font-size: 13px; color: #1e293b;">
            <span>Sticker Labels (${orders.length})</span>
          </div>
          <div style="display: flex; gap: 8px;">
            <button onclick="window.print()" style="cursor: pointer; background-color: #000000; color: #ffffff; border: none; padding: 6px 14px; border-radius: 6px; font-weight: 600; font-size: 12px; display: flex; align-items: center; gap: 6px;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
              Print Stickers
            </button>
            <button onclick="window.close()" style="cursor: pointer; background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; padding: 6px 12px; border-radius: 6px; font-weight: 500; font-size: 12px;">
              Close
            </button>
          </div>
        </div>
        ${stickersHtml}
      </body>
    </html>
  `;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    
    let hasPrinted = false;
    const triggerPrint = () => {
      if (hasPrinted) return;
      hasPrinted = true;
      try {
        printWindow.focus();
        printWindow.print();
      } catch (err) {
        console.error('Print trigger error:', err);
      }
    };

    if (printWindow.document.fonts && printWindow.document.fonts.ready) {
      printWindow.document.fonts.ready.then(() => {
        setTimeout(triggerPrint, 250);
      });
    }

    printWindow.onload = () => {
      setTimeout(triggerPrint, 250);
    };
    
    setTimeout(triggerPrint, 1000);
  } else {
    toast.error('Pop-up was blocked. Please allow pop-ups for this website to print stickers.');
  }
}
