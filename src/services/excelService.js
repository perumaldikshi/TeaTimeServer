const ExcelJS = require('exceljs');

exports.buildExcel = async (reportData, filterDescription, res) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Tea Time Orders Report');

  // Title Banner
  worksheet.addRow(['Tea Time Management System']);
  worksheet.addRow([`Report Scope: ${filterDescription} | Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`]);
  worksheet.addRow([]); // Spacer Spacer

  // Column Headers
  const headerRow = worksheet.addRow([
    'Order Date',
    'Employee Name',
    'Department',
    'Tea/Coffee Item',
    'Quantity',
    'Unit Price',
    'Total Amount'
  ]);
  
  headerRow.font = { bold: true };

  let currentRowIndex = 5;
  if (reportData.orders && reportData.orders.length > 0) {
    reportData.orders.forEach(order => {
      const row = worksheet.addRow([
        new Date(order.order_date).toLocaleDateString(),
        order.employee_name || 'N/A',
        order.department || 'N/A',
        order.tea_name,
        Number(order.quantity),
        Number(order.unit_price),
        Number(order.amount)
      ]);
      
      row.getCell(5).numFmt = '#,##0';
      row.getCell(6).numFmt = '#,##0.00';
      row.getCell(7).numFmt = '#,##0.00';
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
    'Grand Total', '', '', '', '', '', { formula: `SUM(G5:G${totalRowIndex - 2})` }
  ]);
  
  totalRow.getCell(1).font = { bold: true };
  const sumCell = totalRow.getCell(7);
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
