const PDFDocument = require('pdfkit');

// PDFKit's built-in fonts (Helvetica) don't support the ₹ Unicode glyph.
// Use 'Rs.' as a safe ASCII equivalent throughout the PDF.
const RS = 'Rs.';

exports.buildPDF = (reportData, filterDescription, res) => {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });

  doc.pipe(res);

  // ── Design Tokens ──────────────────────────────────────────
  const primaryColor   = '#4E3629';
  const secondaryColor = '#8D7B68';
  const textColor      = '#333333';
  const gridColor      = '#E0DCD5';
  const mutedBg        = '#F7F4F1';

  // ── Column layout (total usable width ≈ 495) ───────────────
  const startX = 50;
  const COL = {
    date:     { x: startX,       w: 62  },
    name:     { x: startX + 62,  w: 100 },
    dept:     { x: startX + 162, w: 100 },
    item:     { x: startX + 262, w: 100 },
    qty:      { x: startX + 362, w: 30  },
    price:    { x: startX + 392, w: 50  },
    total:    { x: startX + 442, w: 53  },
  };
  const tableRight = startX + 495;

  // ────────────────────────────────────────────────────────────
  // HEADER
  // ────────────────────────────────────────────────────────────
  doc.fillColor(primaryColor)
     .fontSize(20)
     .font('Helvetica-Bold')
     .text('Tea Time Management System', { align: 'center' });

  doc.fontSize(11)
     .fillColor(secondaryColor)
     .font('Helvetica')
     .text('Employee Tea / Coffee Consumption Report', { align: 'center' })
     .moveDown(0.8);

  // Thin ruled line under header
  doc.strokeColor(gridColor).lineWidth(1)
     .moveTo(startX, doc.y).lineTo(tableRight, doc.y).stroke()
     .moveDown(0.6);

  // ── Metadata ────────────────────────────────────────────────
  doc.fillColor(textColor).fontSize(9).font('Helvetica');
  doc.text(`Scope / Filter : ${filterDescription}`, startX);
  doc.text(`Generated Date : ${new Date().toLocaleDateString('en-IN')}`, startX);
  doc.font('Helvetica-Bold')
     .text(`Grand Total    : ${RS} ${reportData.grandTotal.toFixed(2)}`, startX);
  doc.moveDown(1.2);

  // ────────────────────────────────────────────────────────────
  // BEVERAGE SUMMARY
  // ────────────────────────────────────────────────────────────
  if (reportData.beverageSummary && reportData.beverageSummary.length > 0) {
    doc.fillColor(primaryColor).fontSize(11).font('Helvetica-Bold')
       .text('Beverage Summary').moveDown(0.4);

    const drawSumHeader = (y) => {
      doc.rect(startX, y, 400, 16).fill(mutedBg);
      doc.fillColor(primaryColor).fontSize(8.5).font('Helvetica-Bold');
      doc.text('Beverage Item',    startX + 4,   y + 3);
      doc.text('Qty',              startX + 230,  y + 3, { width: 80, align: 'right' });
      doc.text(`Total (${RS})`,    startX + 320,  y + 3, { width: 76, align: 'right' });
      return y + 20;
    };

    let sy = drawSumHeader(doc.y);
    doc.font('Helvetica').fontSize(8.5).fillColor(textColor);

    reportData.beverageSummary.forEach((item, idx) => {
      if (sy > 730) { doc.addPage(); sy = drawSumHeader(50); doc.font('Helvetica').fontSize(8.5).fillColor(textColor); }
      if (idx % 2 === 0) doc.rect(startX, sy, 400, 15).fill('#FAFAF8');
      doc.fillColor(textColor);
      doc.text(item.tea_name,                     startX + 4,  sy + 2);
      doc.text(item.total_qty.toString(),          startX + 230, sy + 2, { width: 80, align: 'right' });
      doc.text(`${RS} ${Number(item.total_amt).toFixed(2)}`, startX + 320, sy + 2, { width: 76, align: 'right' });
      sy += 15;
    });

    doc.y = sy + 12;
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
    doc.rect(startX, y, 495, 18).fill(primaryColor);
    doc.fillColor('#FFFFFF').fontSize(8.5).font('Helvetica-Bold');
    doc.text('Date',          COL.date.x  + 2, y + 4, { width: COL.date.w  - 2 });
    doc.text('Employee',      COL.name.x  + 2, y + 4, { width: COL.name.w  - 2 });
    doc.text('Department',    COL.dept.x  + 2, y + 4, { width: COL.dept.w  - 2 });
    doc.text('Item',          COL.item.x  + 2, y + 4, { width: COL.item.w  - 2 });
    doc.text('Qty',           COL.qty.x,        y + 4, { width: COL.qty.w,   align: 'right' });
    doc.text('Price',         COL.price.x,      y + 4, { width: COL.price.w, align: 'right' });
    doc.text(`Total(${RS})`,  COL.total.x,      y + 4, { width: COL.total.w, align: 'right' });
    return y + 22;
  };

  let y = drawTableHeader(doc.y);
  doc.font('Helvetica').fontSize(8.5).fillColor(textColor);

  const truncate = (str, maxLen) => {
    if (!str) return 'N/A';
    return str.length > maxLen ? str.substring(0, maxLen - 1) + '…' : str;
  };

  if (reportData.orders && reportData.orders.length > 0) {
    reportData.orders.forEach((order, idx) => {
      if (y > 730) {
        doc.addPage();
        y = drawTableHeader(50);
        doc.font('Helvetica').fontSize(8.5).fillColor(textColor);
      }

      // Alternating row background
      if (idx % 2 === 0) {
        doc.rect(startX, y, 495, 16).fill(mutedBg);
      }

      const orderDate = order.order_date
        ? new Date(order.order_date + 'T00:00:00').toLocaleDateString('en-IN')
        : new Date(order.created_at).toLocaleDateString('en-IN');

      doc.fillColor(textColor);
      doc.text(orderDate,                              COL.date.x  + 2, y + 3, { width: COL.date.w  - 2, lineBreak: false });
      doc.text(truncate(order.employee_name, 17),      COL.name.x  + 2, y + 3, { width: COL.name.w  - 2, lineBreak: false });
      doc.text(truncate(order.department,   17),       COL.dept.x  + 2, y + 3, { width: COL.dept.w  - 2, lineBreak: false });
      doc.text(truncate(order.tea_name,     17),       COL.item.x  + 2, y + 3, { width: COL.item.w  - 2, lineBreak: false });
      doc.text(order.quantity.toString(),              COL.qty.x,        y + 3, { width: COL.qty.w,   align: 'right', lineBreak: false });
      doc.text(Number(order.unit_price).toFixed(2),   COL.price.x,      y + 3, { width: COL.price.w, align: 'right', lineBreak: false });
      doc.text(Number(order.amount).toFixed(2),        COL.total.x,      y + 3, { width: COL.total.w, align: 'right', lineBreak: false });

      // Row bottom rule
      doc.strokeColor(gridColor).lineWidth(0.3)
         .moveTo(startX, y + 16).lineTo(tableRight, y + 16).stroke();

      y += 16;
    });
  } else {
    doc.text('No order records found matching the criteria.', startX, y + 10, { align: 'center', width: 495 });
    y += 30;
  }

  // ────────────────────────────────────────────────────────────
  // GRAND TOTAL FOOTER
  // ────────────────────────────────────────────────────────────
  y += 8;
  if (y > 740) { doc.addPage(); y = 50; }

  doc.rect(startX, y, 495, 22).fill(primaryColor);
  doc.fillColor('#FFFFFF').fontSize(10).font('Helvetica-Bold');
  doc.text('GRAND TOTAL', COL.date.x + 2, y + 5, { width: 380 });
  doc.text(`${RS} ${reportData.grandTotal.toFixed(2)}`, COL.total.x, y + 5, { width: COL.total.w, align: 'right' });

  // Footer note
  y += 32;
  doc.fillColor(secondaryColor).fontSize(7.5).font('Helvetica')
     .text('* Generated by Tea Time Management System  |  Amounts in Indian Rupees (INR)', startX, y, { align: 'center', width: 495 });

  doc.end();
};
