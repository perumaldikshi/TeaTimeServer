const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

// NotoSans supports the ₹ Unicode glyph (U+20B9) which standard Helvetica cannot render.
const FONT_REGULAR = path.join(__dirname, '..', 'assets', 'fonts', 'NotoSans-Regular.ttf');
const FONT_BOLD    = path.join(__dirname, '..', 'assets', 'fonts', 'NotoSans-Bold.ttf');
const hasFonts = fs.existsSync(FONT_REGULAR);

exports.buildPDF = (reportData, filterDescription, res) => {
  // Use Landscape A4 for ample width so every column and row value displays in full without truncation
  const doc = new PDFDocument({ margin: 35, size: 'A4', layout: 'landscape' });

  // Register custom fonts if available
  if (hasFonts) {
    doc.registerFont('Regular', FONT_REGULAR);
    if (fs.existsSync(FONT_BOLD)) doc.registerFont('Bold', FONT_BOLD);
    else doc.registerFont('Bold', FONT_REGULAR);
  }

  const F_REG  = hasFonts ? 'Regular' : 'Helvetica';
  const F_BOLD = hasFonts ? 'Bold'    : 'Helvetica-Bold';
  const RS     = '\u20B9'; // ₹
  doc.pipe(res);

  // ── Design Tokens ──────────────────────────────────────────
  const primaryColor   = '#4E3629';
  const secondaryColor = '#8D7B68';
  const textColor      = '#333333';
  const gridColor      = '#E0DCD5';
  const mutedBg        = '#F7F4F1';

  // ── Column layout (Total usable width = 770 on Landscape A4) ────────
  const startX = 35;
  const COL = {
    date:  { x: startX,       w: 105 },
    name:  { x: startX + 105, w: 165 },
    dept:  { x: startX + 270, w: 145 },
    item:  { x: startX + 415, w: 140 },
    sugar: { x: startX + 555, w: 85  },
    qty:   { x: startX + 640, w: 35  },
    price: { x: startX + 675, w: 45  },
    total: { x: startX + 720, w: 50  },
  };
  const tableTotalWidth = 770;
  const tableRight = startX + tableTotalWidth;

  // ────────────────────────────────────────────────────────────
  // HEADER
  // ────────────────────────────────────────────────────────────
  doc.fillColor(primaryColor)
     .fontSize(20)
     .font(F_BOLD)
     .text('Tea Time Management System', { align: 'center', width: tableTotalWidth });

  doc.fontSize(11)
     .fillColor(secondaryColor)
     .font(F_REG)
     .text('Employee Tea / Coffee Consumption Report', { align: 'center', width: tableTotalWidth })
     .moveDown(0.6);

  // Thin ruled line under header
  doc.strokeColor(gridColor).lineWidth(1)
     .moveTo(startX, doc.y).lineTo(tableRight, doc.y).stroke()
     .moveDown(0.6);

  // ── Metadata ────────────────────────────────────────────────
  doc.fillColor(textColor).fontSize(9).font(F_REG);
  doc.text(`Scope / Filter : ${filterDescription}`, startX);
  doc.text(`Generated At   : ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`, startX);
  doc.font(F_BOLD)
     .text(`Grand Total    : ${RS} ${reportData.grandTotal.toFixed(2)}`, startX);
  doc.moveDown(1.0);

  // ────────────────────────────────────────────────────────────
  // BEVERAGE SUMMARY
  // ────────────────────────────────────────────────────────────
  if (reportData.beverageSummary && reportData.beverageSummary.length > 0) {
    doc.fillColor(primaryColor).fontSize(11).font(F_BOLD)
       .text('Beverage Summary').moveDown(0.4);

    const sumWidth = 520;
    const drawSumHeader = (y) => {
      doc.rect(startX, y, sumWidth, 18).fill(mutedBg);
      doc.fillColor(primaryColor).fontSize(9).font(F_BOLD);
      doc.text('Beverage Item', startX + 6, y + 4, { width: 320 });
      doc.text('Qty',           startX + 330, y + 4, { width: 80, align: 'right' });
      doc.text(`Total (${RS})`,  startX + 420, y + 4, { width: 90, align: 'right' });
      return y + 20;
    };

    let sy = drawSumHeader(doc.y);
    doc.font(F_REG).fontSize(8.5).fillColor(textColor);

    reportData.beverageSummary.forEach((item, idx) => {
      if (sy > 530) {
        doc.addPage();
        sy = drawSumHeader(35);
        doc.font(F_REG).fontSize(8.5).fillColor(textColor);
      }
      if (idx % 2 === 0) doc.rect(startX, sy, sumWidth, 16).fill('#FAFAF8');
      doc.fillColor(textColor);
      doc.text(item.tea_name,                     startX + 6,   sy + 3, { width: 320 });
      doc.text(item.total_qty.toString(),          startX + 330, sy + 3, { width: 80, align: 'right' });
      doc.text(`${RS} ${Number(item.total_amt).toFixed(2)}`, startX + 420, sy + 3, { width: 90, align: 'right' });
      sy += 16;
    });

    doc.y = sy + 10;
  }

  // Separator
  doc.strokeColor(secondaryColor).lineWidth(1)
     .moveTo(startX, doc.y).lineTo(tableRight, doc.y).stroke()
     .moveDown(0.8);

  // ────────────────────────────────────────────────────────────
  // ORDER TABLE
  // ────────────────────────────────────────────────────────────
  const drawTableHeader = (y) => {
    // Header background
    doc.rect(startX, y, tableTotalWidth, 20).fill(primaryColor);
    doc.fillColor('#FFFFFF').fontSize(8.5).font(F_BOLD);
    doc.text('Date & Time',   COL.date.x  + 2, y + 5, { width: COL.date.w  - 4 });
    doc.text('Employee',      COL.name.x  + 2, y + 5, { width: COL.name.w  - 4 });
    doc.text('Department',    COL.dept.x  + 2, y + 5, { width: COL.dept.w  - 4 });
    doc.text('Item',          COL.item.x  + 2, y + 5, { width: COL.item.w  - 4 });
    doc.text('Sugar',         COL.sugar.x + 2, y + 5, { width: COL.sugar.w - 4 });
    doc.text('Qty',           COL.qty.x,        y + 5, { width: COL.qty.w,   align: 'right' });
    doc.text('Price',         COL.price.x,      y + 5, { width: COL.price.w, align: 'right' });
    doc.text(`Total(${RS})`,  COL.total.x,      y + 5, { width: COL.total.w, align: 'right' });
    return y + 24;
  };

  let y = drawTableHeader(doc.y);
  doc.font(F_REG).fontSize(8.5).fillColor(textColor);

  if (reportData.orders && reportData.orders.length > 0) {
    reportData.orders.forEach((order, idx) => {
      const orderDate = order.created_at
        ? new Date(order.created_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })
        : new Date(order.order_date).toLocaleString('en-IN', { dateStyle: 'short' });

      const nameStr = order.employee_name || 'N/A';
      const deptStr = order.department || 'N/A';
      const itemStr = order.tea_name || 'N/A';

      let sugarText = '—';
      if (order.item_type === 'drink') {
        sugarText = order.sugar_preference === 'with_sugar' ? 'With Sugar' : 'No Sugar';
        if (order.cup_type) {
          sugarText += ` (${order.cup_type})`;
        }
      } else {
        sugarText = 'Snack';
      }

      // Calculate required row height to ensure full display of all text without truncation
      doc.font(F_REG).fontSize(8.5);
      const hDate  = doc.heightOfString(orderDate, { width: COL.date.w - 4 });
      const hName  = doc.heightOfString(nameStr,   { width: COL.name.w - 4 });
      const hDept  = doc.heightOfString(deptStr,   { width: COL.dept.w - 4 });
      const hItem  = doc.heightOfString(itemStr,   { width: COL.item.w - 4 });
      const hSugar = doc.heightOfString(sugarText, { width: COL.sugar.w - 4 });
      const rowHeight = Math.max(16, hDate, hName, hDept, hItem, hSugar) + 6;

      // Check for page overflow
      if (y + rowHeight > 540) {
        doc.addPage();
        y = drawTableHeader(35);
        doc.font(F_REG).fontSize(8.5).fillColor(textColor);
      }

      // Alternating row background
      if (idx % 2 === 0) {
        doc.rect(startX, y, tableTotalWidth, rowHeight).fill(mutedBg);
      }

      doc.fillColor(textColor);
      // Full text output with word wrapping enabled so values are NEVER truncated
      doc.text(orderDate,                            COL.date.x  + 2, y + 3, { width: COL.date.w  - 4 });
      doc.text(nameStr,                              COL.name.x  + 2, y + 3, { width: COL.name.w  - 4 });
      doc.text(deptStr,                              COL.dept.x  + 2, y + 3, { width: COL.dept.w  - 4 });
      doc.text(itemStr,                              COL.item.x  + 2, y + 3, { width: COL.item.w  - 4 });
      doc.text(sugarText,                            COL.sugar.x + 2, y + 3, { width: COL.sugar.w - 4 });
      doc.text(order.quantity.toString(),            COL.qty.x,        y + 3, { width: COL.qty.w,   align: 'right' });
      doc.text(Number(order.unit_price).toFixed(2), COL.price.x,      y + 3, { width: COL.price.w, align: 'right' });
      doc.text(Number(order.amount).toFixed(2),      COL.total.x,      y + 3, { width: COL.total.w, align: 'right' });

      // Row bottom border
      doc.strokeColor(gridColor).lineWidth(0.4)
         .moveTo(startX, y + rowHeight).lineTo(tableRight, y + rowHeight).stroke();

      y += rowHeight;
    });
  } else {
    doc.text('No order records found matching the criteria.', startX, y + 10, { align: 'center', width: tableTotalWidth });
    y += 30;
  }

  // ────────────────────────────────────────────────────────────
  // GRAND TOTAL FOOTER
  // ────────────────────────────────────────────────────────────
  y += 8;
  if (y > 540) {
    doc.addPage();
    y = 35;
  }

  doc.rect(startX, y, tableTotalWidth, 22).fill(primaryColor);
  doc.fillColor('#FFFFFF').fontSize(10).font(F_BOLD);
  doc.text('GRAND TOTAL', COL.date.x + 4, y + 5, { width: 500 });
  doc.text(`${RS} ${reportData.grandTotal.toFixed(2)}`, COL.total.x, y + 5, { width: COL.total.w, align: 'right' });

  // Footer note
  y += 30;
  doc.fillColor(secondaryColor).fontSize(8).font(F_REG)
     .text('* Generated by Tea Time Management System  |  Amounts in Indian Rupees (INR)', startX, y, { align: 'center', width: tableTotalWidth });

  doc.end();
};
