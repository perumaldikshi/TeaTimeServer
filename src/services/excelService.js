const ExcelJS = require('exceljs');

exports.buildExcel = async (reportData, filterDescription, res) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Tea Time Orders Report');

  // Title Banner
  worksheet.mergeCells('A1:G1');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = 'Tea Time Management System';
  titleCell.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4E3629' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  worksheet.getRow(1).height = 40;

  // Subtitle Metadata
  worksheet.mergeCells('A2:G2');
  const subTitleCell = worksheet.getCell('A2');
  subTitleCell.value = `Report Scope: ${filterDescription} | Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`;
  subTitleCell.font = { name: 'Arial', size: 10, italic: true };
  subTitleCell.alignment = { vertical: 'middle', horizontal: 'left' };
  worksheet.getRow(2).height = 20;

  // Empty Spacer Row
  worksheet.addRow([]);

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
  
  headerRow.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF8D7B68' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF4E3629' } },
      bottom: { style: 'medium', color: { argb: 'FF4E3629' } },
      left: { style: 'thin', color: { argb: 'FF8D7B68' } },
      right: { style: 'thin', color: { argb: 'FF8D7B68' } }
    };
  });
  worksheet.getRow(4).height = 25;

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
      
      // Formatting
      row.getCell(1).alignment = { horizontal: 'center' };
      row.getCell(5).numFmt = '#,##0';
      row.getCell(5).alignment = { horizontal: 'right' };
      row.getCell(6).numFmt = '"₹"#,##0.00';
      row.getCell(6).alignment = { horizontal: 'right' };
      row.getCell(7).numFmt = '"₹"#,##0.00';
      row.getCell(7).alignment = { horizontal: 'right' };
      
      row.eachCell(cell => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFECECEC' } },
          bottom: { style: 'thin', color: { argb: 'FFECECEC' } },
          left: { style: 'thin', color: { argb: 'FFECECEC' } },
          right: { style: 'thin', color: { argb: 'FFECECEC' } }
        };
      });
      currentRowIndex++;
    });
  } else {
    const emptyRow = worksheet.addRow(['No data records found matching the specified filters.', '', '', '', '', '', '']);
    worksheet.mergeCells(`A${currentRowIndex}:G${currentRowIndex}`);
    emptyRow.getCell(1).alignment = { horizontal: 'center' };
    currentRowIndex++;
  }

  // Add Grand Total Row
  worksheet.addRow([]); // Space
  currentRowIndex++;

  const totalRowIndex = currentRowIndex;
  const totalRow = worksheet.addRow([
    'Grand Total', '', '', '', '', '', { formula: `SUM(G5:G${totalRowIndex - 2})` }
  ]);
  
  // Format Grand Total Row
  worksheet.mergeCells(`A${totalRowIndex}:F${totalRowIndex}`);
  const labelCell = worksheet.getCell(`A${totalRowIndex}`);
  labelCell.alignment = { horizontal: 'right', vertical: 'middle' };
  labelCell.font = { name: 'Arial', size: 11, bold: true };
  
  const sumCell = worksheet.getCell(`G${totalRowIndex}`);
  sumCell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF4E3629' } };
  sumCell.numFmt = '"₹"#,##0.00';
  sumCell.alignment = { horizontal: 'right', vertical: 'middle' };
  sumCell.border = {
    top: { style: 'double', color: { argb: 'FF4E3629' } },
    bottom: { style: 'double', color: { argb: 'FF4E3629' } }
  };
  worksheet.getRow(totalRowIndex).height = 22;

  // Auto-fit Column Widths
  worksheet.columns.forEach(column => {
    let maxLength = 10;
    column.eachCell({ includeEmpty: false }, cell => {
      let cellValue = cell.value ? cell.value.toString() : '';
      if (cellValue.startsWith('=')) cellValue = '₹123,456.00'; // mock formula length
      if (cell.address.startsWith('A') && cell.row === 1) cellValue = ''; // Skip main title
      if (cellValue.length > maxLength) {
        maxLength = cellValue.length;
      }
    });
    column.width = maxLength + 4;
  });

  // Stream workbook response
  await workbook.xlsx.write(res);
};
