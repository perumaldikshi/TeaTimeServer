const PDFDocument = require('pdfkit');

exports.buildPDF = (reportData, filterDescription, res) => {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });

  // Stream the PDF to response
  doc.pipe(res);

  // Colors & Layout Constants
  const primaryColor = '#4E3629'; // Elegant Tea/Coffee Brown
  const secondaryColor = '#8D7B68';
  const textColor = '#333333';
  const gridColor = '#E0DCD5';
  const startX = 50;

  // Title / Header
  doc.fillColor(primaryColor)
     .fontSize(22)
     .text('Tea Time Management System', { align: 'center', bold: true });
     
  doc.fontSize(12)
     .fillColor(secondaryColor)
     .text('Employee Tea/Coffee Consumption Report', { align: 'center' })
     .moveDown(1);

  // Metadata Block
  doc.fillColor(textColor)
     .fontSize(10)
     .font('Helvetica-Bold')
     .text('Report Details:')
     .font('Helvetica')
     .text(`Scope / Filter: ${filterDescription}`)
     .text(`Generated Date: ${new Date().toLocaleDateString()}`)
     .font('Helvetica-Bold')
     .text(`Grand Total: ₹${reportData.grandTotal.toFixed(2)}`, { color: primaryColor })
     .moveDown(2);

  // Beverages Count Summary Section
  if (reportData.beverageSummary && reportData.beverageSummary.length > 0) {
    doc.fillColor(primaryColor)
       .fontSize(12)
       .font('Helvetica-Bold')
       .text('Beverages Count Summary')
       .moveDown(0.5);

    let sumY = doc.y;

    // Summary Table Headers
    doc.fillColor(secondaryColor).fontSize(9).font('Helvetica-Bold');
    doc.text('Beverage Item', startX, sumY);
    doc.text('Quantity Ordered', startX + 180, sumY, { width: 100, align: 'right' });
    doc.text('Total Cost', startX + 300, sumY, { width: 100, align: 'right' });

    // Underline summary headers
    doc.strokeColor(gridColor)
       .lineWidth(0.5)
       .moveTo(startX, sumY + 12)
       .lineTo(startX + 400, sumY + 12)
       .stroke();

    sumY += 18;
    doc.font('Helvetica').fontSize(9).fillColor(textColor);
    reportData.beverageSummary.forEach(item => {
      if (sumY > 740) {
        doc.addPage();
        sumY = 50;
        
        doc.fillColor(secondaryColor).fontSize(9).font('Helvetica-Bold');
        doc.text('Beverage Item', startX, sumY);
        doc.text('Quantity Ordered', startX + 180, sumY, { width: 100, align: 'right' });
        doc.text('Total Cost', startX + 300, sumY, { width: 100, align: 'right' });

        doc.strokeColor(gridColor)
           .lineWidth(0.5)
           .moveTo(startX, sumY + 12)
           .lineTo(startX + 400, sumY + 12)
           .stroke();

        sumY += 18;
        doc.font('Helvetica').fontSize(9).fillColor(textColor);
      }

      doc.text(item.tea_name, startX, sumY);
      doc.text(item.total_qty.toString(), startX + 180, sumY, { width: 100, align: 'right' });
      doc.text(`₹${Number(item.total_amt).toFixed(2)}`, startX + 300, sumY, { width: 100, align: 'right' });
      sumY += 16;
    });

    doc.y = sumY + 15;
    doc.moveDown(1);
  }

  // Draw separator line
  doc.strokeColor(secondaryColor)
     .lineWidth(1)
     .moveTo(startX, doc.y)
     .lineTo(545, doc.y)
     .stroke()
     .moveDown(1);

  // Table Headers
  const startY = doc.y;
  
  doc.fillColor(primaryColor).fontSize(10).font('Helvetica-Bold');
  doc.text('Date', startX, startY);
  doc.text('Employee Name', startX + 70, startY);
  doc.text('Department', startX + 180, startY);
  doc.text('Tea/Coffee Item', startX + 280, startY);
  doc.text('Qty', startX + 380, startY, { width: 30, align: 'right' });
  doc.text('Price', startX + 420, startY, { width: 40, align: 'right' });
  doc.text('Total', startX + 470, startY, { width: 45, align: 'right' });

  doc.strokeColor(primaryColor)
     .lineWidth(1)
     .moveTo(startX, startY + 15)
     .lineTo(startX + 515, startY + 15)
     .stroke();

  let y = startY + 25;
  
  // Rows
  doc.fontSize(9).font('Helvetica').fillColor(textColor);
  
  if (reportData.orders && reportData.orders.length > 0) {
    reportData.orders.forEach(order => {
      // Check for page overflow
      if (y > 740) {
        doc.addPage();
        y = 50;
        
        // Redraw headers on new page
        doc.fillColor(primaryColor).fontSize(10).font('Helvetica-Bold');
        doc.text('Date', startX, y);
        doc.text('Employee Name', startX + 70, y);
        doc.text('Department', startX + 180, y);
        doc.text('Tea/Coffee Item', startX + 280, y);
        doc.text('Qty', startX + 380, y, { width: 30, align: 'right' });
        doc.text('Price', startX + 420, y, { width: 40, align: 'right' });
        doc.text('Total', startX + 470, y, { width: 45, align: 'right' });
        
        doc.strokeColor(primaryColor)
           .lineWidth(1)
           .moveTo(startX, y + 15)
           .lineTo(startX + 515, y + 15)
           .stroke();
           
        y += 25;
        doc.fontSize(9).font('Helvetica').fillColor(textColor);
      }

      const orderDate = new Date(order.order_date).toLocaleDateString();
      doc.text(orderDate, startX, y);
      doc.text(order.employee_name || 'N/A', startX + 70, y, { width: 105, ellipsis: true });
      doc.text(order.department || 'N/A', startX + 180, y, { width: 95, ellipsis: true });
      doc.text(order.tea_name, startX + 280, y);
      doc.text(order.quantity.toString(), startX + 380, y, { width: 30, align: 'right' });
      doc.text(`₹${Number(order.unit_price).toFixed(2)}`, startX + 420, y, { width: 40, align: 'right' });
      doc.text(`₹${Number(order.amount).toFixed(2)}`, startX + 470, y, { width: 45, align: 'right' });
      
      // Draw subgrid line
      doc.strokeColor(gridColor)
         .lineWidth(0.5)
         .moveTo(startX, y + 15)
         .lineTo(startX + 515, y + 15)
         .stroke();

      y += 22;
    });
  } else {
    doc.text('No order records found matching the criteria.', startX, y + 10, { align: 'center' });
    y += 30;
  }

  // Footer / Final Summary Total
  y += 10;
  if (y > 740) {
    doc.addPage();
    y = 50;
  }

  doc.strokeColor(primaryColor)
     .lineWidth(1.5)
     .moveTo(startX, y)
     .lineTo(startX + 515, y)
     .stroke();

  y += 10;
  doc.fontSize(11).font('Helvetica-Bold').fillColor(primaryColor);
  doc.text('Grand Total:', startX + 320, y);
  doc.text(`₹${reportData.grandTotal.toFixed(2)}`, startX + 420, y, { width: 95, align: 'right' });

  doc.end();
};
