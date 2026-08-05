const ExcelJS = require('exceljs');

exports.buildExcel = async (reportData, filterDescription, res) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Tea Time Orders Report');

  // Title Banner
  worksheet.addRow(['Tea Time Management System']);
  worksheet.addRow([`Report Scope: ${filterDescription} | Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`]);
  worksheet.addRow([]); // Spacer Spacer

  // Side-by-side Beverages Count Summary on Columns I, J, K
  if (reportData.beverageSummary && reportData.beverageSummary.length > 0) {
    // Summary Title Card
    worksheet.mergeCells('I4:K4');
    const summaryTitle = worksheet.getCell('I4');
    summaryTitle.value = 'Beverages Count Summary';
    summaryTitle.font = { bold: true, color: { argb: 'FF4E3629' }, size: 11 };
    summaryTitle.alignment = { horizontal: 'center', vertical: 'middle' };
    
    // Summary Headers
    worksheet.getCell('I5').value = 'Beverage Item';
    worksheet.getCell('J5').value = 'Quantity';
    worksheet.getCell('K5').value = 'Total Cost';

    ['I5', 'J5', 'K5'].forEach(cellRef => {
      const cell = worksheet.getCell(cellRef);
      cell.font = { bold: true };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0DCD5' }
      };
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'FF8D7B68' } }
      };
    });

    let sumRowIndex = 6;
    reportData.beverageSummary.forEach(item => {
      worksheet.getCell(`I${sumRowIndex}`).value = item.tea_name;
      worksheet.getCell(`J${sumRowIndex}`).value = Number(item.total_qty);
      worksheet.getCell(`K${sumRowIndex}`).value = Number(item.total_amt);

      worksheet.getCell(`J${sumRowIndex}`).numFmt = '#,##0';
      worksheet.getCell(`K${sumRowIndex}`).numFmt = '#,##0.00';
      
      // Add subtle gridline under the item row
      ['I', 'J', 'K'].forEach(col => {
        worksheet.getCell(`${col}${sumRowIndex}`).border = {
          bottom: { style: 'thin', color: { argb: 'FFE0DCD5' } }
        };
      });
      
      sumRowIndex++;
    });
  }

  const headerRow = worksheet.addRow([
    'Order Date',
    'Employee Name',
    'Department',
    'Tea/Coffee Item',
    'Sugar Preference',
    'Quantity',
    'Unit Price',
    'Total Amount'
  ]);
  
  headerRow.font = { bold: true };

  let currentRowIndex = 5;
  if (reportData.orders && reportData.orders.length > 0) {
    reportData.orders.forEach(order => {
      let sugarText = '—';
      if (order.item_type === 'drink') {
        sugarText = order.sugar_preference === 'with_sugar' ? 'With Sugar' : 'No Sugar';
      }

      const row = worksheet.addRow([
        new Date(order.order_date).toLocaleDateString(),
        order.employee_name || 'N/A',
        order.department || 'N/A',
        order.tea_name,
        sugarText,
        Number(order.quantity),
        Number(order.unit_price),
        Number(order.amount)
      ]);
      
      row.getCell(6).numFmt = '#,##0';
      row.getCell(7).numFmt = '#,##0.00';
      row.getCell(8).numFmt = '#,##0.00';
      currentRowIndex++;
    });
  } else {
    worksheet.addRow(['No data records found matching the specified filters.']);
    currentRowIndex++;
  }

  // Add Grand Total Row
  worksheet.addRow([]); // Space
  currentRowIndex++;

  const totalRowIndex = currentRowIndex;
  const totalRow = worksheet.addRow([
    'Grand Total', '', '', '', '', '', '', { formula: `SUM(H5:H${totalRowIndex - 2})` }
  ]);
  
  totalRow.getCell(1).font = { bold: true };
  const sumCell = totalRow.getCell(8);
  sumCell.font = { bold: true };
  sumCell.numFmt = '#,##0.00';

  // Auto-fit Column Widths
  worksheet.columns.forEach(column => {
    let maxLength = 10;
    column.eachCell({ includeEmpty: false }, cell => {
      let cellValue = cell.value ? cell.value.toString() : '';
      if (cellValue.startsWith('=')) cellValue = '123,456.00';
      if (cellValue.length > maxLength) {
        maxLength = cellValue.length;
      }
    });
    column.width = maxLength + 4;
  });

  // Stream workbook response
  await workbook.xlsx.write(res);
};
