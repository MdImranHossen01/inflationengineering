import { format, isValid } from 'date-fns';
import { toast } from 'sonner';

export async function generateInvoicePDF(orderOrOrders: any | any[], settings: any, mode: 'download' | 'print' = 'download') {
  const orders = Array.isArray(orderOrOrders) ? orderOrOrders : [orderOrOrders];
  if (orders.length === 0) return;

  const brandName = settings?.brandName || "Inflation Engineering";
  const brandEmail = settings?.contact?.email || "";
  const brandPhone = settings?.contact?.phone || "";
  const brandAddress = settings?.contact?.address || "";
  const brandLogoUrl = settings?.logoUrl || settings?.logo || "/logo.webp";

  const getAbsoluteUrl = (url: string) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) return url;
    if (typeof window !== 'undefined') {
      return `${window.location.origin}${url.startsWith('/') ? '' : '/'}${url}`;
    }
    return url;
  };
  const finalLogoUrl = getAbsoluteUrl(brandLogoUrl);
  const finalSignUrl = getAbsoluteUrl('/assets/sign.png');

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

  const invoicesHtml = orders.map((order, index) => {
    const invoiceId = String(order._id || order.shortId || "").slice(-8).toUpperCase().replace(/^0+/, '');
    const createdAt = order.createdAt ? new Date(order.createdAt) : null;
    const formattedDate = createdAt && isValid(createdAt) ? format(createdAt, "dd MMM yyyy") : "N/A";

    const items = Array.isArray(order.items) ? order.items : [];
    const subtotalRaw = items.reduce((acc: number, item: any) => {
      const price = Number(item.price) || 0;
      const quantity = Number(item.quantity) || 0;
      return acc + price * quantity;
    }, 0);
    const subtotal = Number.isFinite(subtotalRaw) ? subtotalRaw : 0;
    const deliveryCharge = order.deliveryCharge !== undefined
      ? Number(order.deliveryCharge) || 0
      : Math.max(0, (Number(order.totalAmount) || 0) - subtotal);
    const couponDiscount = Number(order.couponDiscountAmount) || 0;
    const walletUsed = Number(order.walletAmountUsed) || 0;
    const totalAmount = Math.round(order.totalAmount - couponDiscount - walletUsed);

    return `
      <div class="invoice-container" style="${index < orders.length - 1 ? 'page-break-after: always; break-after: page;' : ''}">
        <div class="header">
          <div class="brand-logo-container">
            <h1 class="invoice-title">INVOICE</h1>
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
            <h3>Bill To</h3>
            <p><strong>${order.shippingAddress?.fullName || "Customer"}</strong></p>
            ${order.shippingAddress?.street ? `<p>${order.shippingAddress.street}</p>` : ''}
            <p>${order.shippingAddress?.city || ""}${order.shippingAddress?.zipCode ? `, ${order.shippingAddress.zipCode}` : ""}</p>
            <p>Phone: ${order.shippingAddress?.phone || ""}</p>
          </div>
          <div class="order-info">
            <h3>Order Info</h3>
            <div class="info-row">
              <span class="info-label">Invoice #</span>
              <span>${invoiceId}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Date</span>
              <span>${formattedDate}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Payment</span>
              <span>${order.paymentMethod || "N/A"}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Status</span>
              <span>${order.status || "Pending"}</span>
            </div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 50px;">#</th>
              <th>Product</th>
              <th class="text-center" style="width: 80px;">Qty</th>
              <th class="text-right" style="width: 120px;">Unit Price</th>
              <th class="text-right" style="width: 120px;">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${items.map((item: any, idx: number) => `
              <tr>
                <td>${idx + 1}</td>
                <td>
                  <strong>${item.name}</strong>
                  ${item.color || item.size ? `<br><small style="color: var(--muted-foreground)">Color: ${item.color || 'N/A'} | Size: ${item.size || 'N/A'}</small>` : ''}
                </td>
                <td class="text-center">${item.quantity}</td>
                <td class="text-right">৳${Math.round(item.price)}</td>
                <td class="text-right">৳${Math.round(item.price * item.quantity)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="totals-container">
          <div class="totals-box">
            <div class="total-row">
              <span>Subtotal:</span>
              <span>৳${Math.round(subtotal)}</span>
            </div>
            <div class="total-row">
              <span>Shipping Charge:</span>
              <span>৳${Math.round(deliveryCharge)}</span>
            </div>
            <div class="total-row" style="${couponDiscount > 0 ? 'color: var(--foreground);' : ''}">
              <span>Coupon Discount:</span>
              <span>${couponDiscount > 0 ? `- ৳${Math.round(couponDiscount)}` : '৳0'}</span>
            </div>
            <div class="total-row" style="${walletUsed > 0 ? 'color: var(--foreground);' : ''}">
              <span>Loyalty Discount:</span>
              <span>${walletUsed > 0 ? `- ৳${Math.round(walletUsed)}` : '৳0'}</span>
            </div>
            <div class="total-row grand-total">
              <span>Total Amount:</span>
              <span>৳${totalAmount}</span>
            </div>
          </div>
        </div>

        <div style="display: flex; justify-content: flex-end; margin-top: 24px;">
          <div style="display: flex; flex-direction: column; align-items: center; text-align: center; min-width: 140px;">
            <img src="${finalSignUrl}" alt="Seal & Signature" style="height: 52px; max-width: 130px; object-fit: contain; display: block; margin-bottom: 2px; mix-blend-mode: multiply;" />
            <div style="font-size: 10.5px; font-weight: 600; color: var(--muted-foreground); border-top: 1px dashed #cbd5e1; padding-top: 3px; width: 100%; letter-spacing: 0.02em;">Authorized Signature</div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Invoice Print</title>
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Bengali:wght@400;700&family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
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
            font-family: 'Inter', 'Noto Sans Bengali', sans-serif;
            margin: 0;
            padding: 20px;
            color: var(--foreground);
            background-color: var(--background);
            font-size: 14px;
            line-height: 1.5;
          }
          .invoice-container {
            max-width: 800px;
            margin: 0 auto;
            background: var(--background);
            padding: 20px;
            page-break-inside: avoid;
            break-inside: avoid;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid var(--border);
            padding-bottom: 16px;
            margin-bottom: 16px;
            gap: 16px;
          }
          .brand-logo-container {
            display: flex;
            flex-direction: column;
            flex: 1;
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
            font-size: 16px;
            font-weight: 700;
            color: var(--primary);
            text-transform: uppercase;
            margin-bottom: 3px;
            letter-spacing: 0.04em;
          }
          .brand-details {
            font-size: 11px;
            color: var(--muted-foreground);
            line-height: 1.35;
          }
          .invoice-title {
            font-size: 26px;
            font-weight: 800;
            color: var(--foreground);
            text-align: left;
            margin: 0 0 3px 0;
            letter-spacing: -0.025em;
            text-transform: uppercase;
          }
          .details-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 30px;
          }
          .bill-to h3, .order-info h3 {
            font-size: 12px;
            font-weight: 700;
            text-transform: uppercase;
            margin-bottom: 10px;
            color: var(--muted-foreground);
          }
          .bill-to p, .order-info p {
            margin: 4px 0;
          }
          .info-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 4px;
          }
          .info-label {
            font-weight: 600;
            color: var(--muted-foreground);
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
          }
          th {
            background-color: var(--primary);
            color: var(--primary-foreground);
            text-align: left;
            padding: 8px 10px;
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            border-top: 1px solid #cbd5e1;
            border-bottom: 2px solid #94a3b8;
          }
          td {
            padding: 8px 10px;
            border-bottom: 1px solid #e2e8f0;
            vertical-align: top;
          }
          .text-right {
            text-align: right;
          }
          .text-center {
            text-align: center;
          }
          .totals-container {
            display: flex;
            justify-content: flex-end;
            margin-bottom: 40px;
          }
          .totals-box {
            width: 300px;
          }
          .total-row {
            display: flex;
            justify-content: space-between;
            padding: 6px 0;
            font-size: 13px;
          }
          .total-row.grand-total {
            border-top: 2px solid var(--border);
            font-size: 16px;
            font-weight: 700;
            padding-top: 10px;
            color: var(--foreground);
          }
          .footer {
            text-align: center;
            font-size: 11px;
            color: var(--muted-foreground);
            border-top: 1px solid var(--border);
            padding-top: 20px;
            margin-top: 40px;
          }
          @media print {
            .no-print {
              display: none !important;
            }
            body {
              padding: 0 !important;
              margin: 0 !important;
            }
            .invoice-container {
              padding: 0 !important;
              max-width: 100% !important;
            }
            @page {
              size: A4;
              margin: 15mm 15mm 18mm 15mm;
              @bottom-right {
                content: "Page " counter(page);
                font-size: 10px;
                font-family: 'Inter', sans-serif;
                font-weight: 600;
                color: #64748b;
              }
            }
          }
        </style>
      </head>
      <body>
        <div class="no-print" style="position: sticky; top: 0; z-index: 9999; background: #ffffff; border-bottom: 1px solid #e2e8f0; padding: 12px 24px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 1px 3px rgba(0,0,0,0.08); margin-bottom: 24px;">
          <div style="font-weight: 600; font-size: 14px; color: #1e293b; display: flex; align-items: center; gap: 8px;">
            <span>${orders.length > 1 ? `Invoices (${orders.length} orders)` : `Invoice #${String(orders[0]?._id || orders[0]?.shortId || "").slice(-8).toUpperCase().replace(/^0+/, '')}`}</span>
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
        ${invoicesHtml}
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
    toast.error('Pop-up was blocked. Please allow pop-ups for this website to print invoices.');
  }
}
