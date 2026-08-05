const db = require('../config/db');
const pdfService = require('../services/pdfService');
const excelService = require('../services/excelService');

// Helper to compile filtered SQL queries
const compileReportData = async (filters) => {
  const { reportType, startDate, endDate, employeeId, department, teaItemId } = filters;
  
  let finalStartDate = startDate;
  let finalEndDate = endDate;
  
  const today = new Date();
  
  if (reportType === 'daily') {
    const todayStr = today.toISOString().split('T')[0];
    finalStartDate = todayStr;
    finalEndDate = todayStr;
  } else if (reportType === 'weekly') {
    const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    finalStartDate = lastWeek.toISOString().split('T')[0];
    finalEndDate = today.toISOString().split('T')[0];
  } else if (reportType === 'monthly') {
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    finalStartDate = startOfMonth.toISOString().split('T')[0];
    finalEndDate = today.toISOString().split('T')[0];
  } else if (reportType === 'yearly') {
    const startOfYear = new Date(today.getFullYear(), 0, 1);
    finalStartDate = startOfYear.toISOString().split('T')[0];
    finalEndDate = today.toISOString().split('T')[0];
  }

  let query = `
    SELECT o.id, o.quantity, o.amount, o.status, o.order_date, o.created_at,
           o.sugar_preference,
           u.name as employee_name, u.email as employee_email, u.department,
           t.name as tea_name, t.price as unit_price, t.item_type
    FROM tea_orders o
    JOIN users u ON o.user_id = u.id
    JOIN tea_items t ON o.tea_item_id = t.id
    WHERE o.status = 'ordered'
  `;
  const params = [];

  if (finalStartDate) {
    params.push(finalStartDate);
    query += ` AND o.order_date >= $${params.length}`;
  }
  if (finalEndDate) {
    params.push(finalEndDate);
    query += ` AND o.order_date <= $${params.length}`;
  }
  if (employeeId) {
    params.push(employeeId);
    query += ` AND o.user_id = $${params.length}`;
  }
  if (department) {
    params.push(department);
    query += ` AND u.department = $${params.length}`;
  }
  if (teaItemId) {
    params.push(teaItemId);
    query += ` AND o.tea_item_id = $${params.length}`;
  }

  query += ' ORDER BY o.order_date DESC, o.created_at DESC';

  const ordersRes = await db.query(query, params);
  
  // Calculate Grand Total, Beverage Summary, and Sugar Preference breakdown
  let grandTotal = 0;
  const beverageSummaryMap = {};
  let withSugarCount = 0;
  let withoutSugarCount = 0;

  ordersRes.rows.forEach(order => {
    grandTotal += Number(order.amount);
    
    const name = order.tea_name;
    const qty = Number(order.quantity);
    const amt = Number(order.amount);

    if (!beverageSummaryMap[name]) {
      beverageSummaryMap[name] = {
        tea_name: name,
        item_type: order.item_type,
        total_qty: 0,
        total_amt: 0,
        with_sugar: 0,
        without_sugar: 0
      };
    }
    beverageSummaryMap[name].total_qty += qty;
    beverageSummaryMap[name].total_amt += amt;

    // Sugar preference count - only for drink items
    if (order.item_type === 'drink') {
      if (order.sugar_preference === 'with_sugar') {
        beverageSummaryMap[name].with_sugar += qty;
        withSugarCount += qty;
      } else if (order.sugar_preference === 'without_sugar') {
        beverageSummaryMap[name].without_sugar += qty;
        withoutSugarCount += qty;
      }
    }
  });

  const beverageSummary = Object.values(beverageSummaryMap).sort((a, b) => b.total_qty - a.total_qty);

  return {
    orders: ordersRes.rows,
    grandTotal,
    beverageSummary,
    sugarSummary: {
      withSugar: withSugarCount,
      withoutSugar: withoutSugarCount,
      total: withSugarCount + withoutSugarCount
    },
    dateRange: {
      startDate: finalStartDate,
      endDate: finalEndDate
    }
  };
};

exports.getReport = async (req, res, next) => {
  try {
    const data = await compileReportData(req.query);
    res.json(data);
  } catch (error) {
    next(error);
  }
};

exports.downloadPdf = async (req, res, next) => {
  try {
    const data = await compileReportData(req.query);
    const filterDesc = req.query.startDate && req.query.endDate && !req.query.reportType
      ? `Custom Report: ${req.query.startDate} to ${req.query.endDate}`
      : req.query.reportType
        ? `${req.query.reportType.toUpperCase()} Report`
        : 'Custom Report';
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=tea_report_${Date.now()}.pdf`);
    
    pdfService.buildPDF(data, filterDesc, res);
  } catch (error) {
    next(error);
  }
};

exports.downloadExcel = async (req, res, next) => {
  try {
    const data = await compileReportData(req.query);
    const filterDesc = req.query.startDate && req.query.endDate && !req.query.reportType
      ? `Custom Report: ${req.query.startDate} to ${req.query.endDate}`
      : req.query.reportType
        ? `${req.query.reportType.toUpperCase()} Report`
        : 'Custom Report';

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=tea_report_${Date.now()}.xlsx`);
    
    await excelService.buildExcel(data, filterDesc, res);
  } catch (error) {
    next(error);
  }
};
