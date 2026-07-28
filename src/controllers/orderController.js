const db = require('../config/db');

// Helper function to check if ordering is open
const isOrderingOpen = async () => {
  try {
    const settingsRes = await db.query('SELECT key, value FROM settings');
    const settings = {};
    settingsRes.rows.forEach(r => {
      settings[r.key] = r.value;
    });

    // If override is explicitly true, ordering is open
    if (settings['is_ordering_open'] === 'true') {
      return { open: true, message: 'Ordering is open (Manual Override)' };
    }

    const now = new Date();
    const currentHour = now.getHours();
    const currentMin = now.getMinutes();
    const currentTimeVal = currentHour * 60 + currentMin; // time in minutes

    // Parse start and cutoff times (Format expected: HH:MM)
    const [startH, startM] = (settings['tea_time_start'] || '16:55').split(':').map(Number);
    const [cutoffH, cutoffM] = (settings['cutoff_time'] || '17:10').split(':').map(Number);

    const startTimeVal = startH * 60 + startM;
    const cutoffTimeVal = cutoffH * 60 + cutoffM;

    if (currentTimeVal >= startTimeVal && currentTimeVal <= cutoffTimeVal) {
      return { open: true, message: 'Ordering is open' };
    }

    return { open: false, message: 'Ordering Closed' };
  } catch (err) {
    console.error('Error checking ordering window:', err);
    return { open: false, message: 'Error checking ordering window' };
  }
};

// 1. Place order
exports.placeOrder = async (req, res, next) => {
  const { teaItemId, quantity } = req.body;
  const userId = req.user.id;

  try {
    if (!teaItemId || !quantity || quantity <= 0) {
      return res.status(400).json({ error: 'Valid teaItemId and quantity are required' });
    }

    // Check if ordering is open
    const status = await isOrderingOpen();
    if (!status.open) {
      return res.status(400).json({ error: status.message });
    }

    // Get item details for price calculation
    const itemRes = await db.query('SELECT name, price, is_available FROM tea_items WHERE id = $1', [teaItemId]);
    if (itemRes.rows.length === 0) {
      return res.status(404).json({ error: 'Tea item not found' });
    }

    const item = itemRes.rows[0];
    if (!item.is_available) {
      return res.status(400).json({ error: `${item.name} is currently not available` });
    }

    const amount = Number(item.price) * Number(quantity);

    // Check if the user has already ordered today (Employee can place only one order per day)
    // First, get standard date boundaries or use order_date DEFAULT CURRENT_DATE
    const today = new Date().toISOString().split('T')[0];
    const orderExist = await db.query(
      'SELECT id FROM tea_orders WHERE user_id = $1 AND order_date = $2 AND status = \'ordered\'',
      [userId, today]
    );

    if (orderExist.rows.length > 0) {
      return res.status(400).json({ error: 'You have already placed an order for today' });
    }

    // Create Order
    const insertRes = await db.query(
      'INSERT INTO tea_orders (user_id, tea_item_id, quantity, amount, status, order_date) VALUES ($1, $2, $3, $4, \'ordered\', $5) RETURNING *',
      [userId, teaItemId, quantity, amount, today]
    );

    res.status(201).json({
      message: 'Order placed successfully',
      order: insertRes.rows[0],
      itemName: item.name
    });
  } catch (error) {
    next(error);
  }
};

// 2. Cancel order
exports.cancelOrder = async (req, res, next) => {
  const orderId = req.params.id;
  const userId = req.user.id;
  const userRole = req.user.role;

  try {
    // Check if ordering is open (cancellations also follow cutoff times unless admin)
    if (userRole !== 'admin') {
      const status = await isOrderingOpen();
      if (!status.open) {
        return res.status(400).json({ error: 'Ordering is closed. Cannot cancel order after cutoff time.' });
      }
    }

    // Find the order
    const orderRes = await db.query('SELECT * FROM tea_orders WHERE id = $1', [orderId]);
    if (orderRes.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = orderRes.rows[0];

    // Restrict cancellation to the owner, unless admin
    if (userRole !== 'admin' && order.user_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized to cancel this order' });
    }

    if (order.status === 'cancelled') {
      return res.status(400).json({ error: 'Order is already cancelled' });
    }

    // Cancel Order
    const updateRes = await db.query(
      'UPDATE tea_orders SET status = \'cancelled\' WHERE id = $1 RETURNING *',
      [orderId]
    );

    res.json({
      message: 'Order cancelled successfully',
      order: updateRes.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

// 3. Get Order History (with Pagination and Filters)
exports.getOrderHistory = async (req, res, next) => {
  const userId = req.user.id;
  const userRole = req.user.role;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;

  // Filters
  const { startDate, endDate, status, teaItemId, search } = req.query;

  try {
    let queryParams = [];
    let countQuery = `
      SELECT COUNT(o.id) 
      FROM tea_orders o
      JOIN users u ON o.user_id = u.id
      JOIN tea_items t ON o.tea_item_id = t.id
      WHERE 1=1
    `;
    let selectQuery = `
      SELECT o.id, o.quantity, o.amount, o.status, o.order_date, o.created_at,
             u.name as employee_name, u.email as employee_email, u.department,
             t.name as tea_name, t.price as unit_price
      FROM tea_orders o
      JOIN users u ON o.user_id = u.id
      JOIN tea_items t ON o.tea_item_id = t.id
      WHERE 1=1
    `;

    // Filter by role: Employees only see their own history
    if (userRole === 'employee') {
      queryParams.push(userId);
      countQuery += ` AND o.user_id = $${queryParams.length}`;
      selectQuery += ` AND o.user_id = $${queryParams.length}`;
    }

    if (status) {
      queryParams.push(status);
      countQuery += ` AND o.status = $${queryParams.length}`;
      selectQuery += ` AND o.status = $${queryParams.length}`;
    }

    if (teaItemId) {
      queryParams.push(teaItemId);
      countQuery += ` AND o.tea_item_id = $${queryParams.length}`;
      selectQuery += ` AND o.tea_item_id = $${queryParams.length}`;
    }

    if (startDate) {
      queryParams.push(startDate);
      countQuery += ` AND o.order_date >= $${queryParams.length}`;
      selectQuery += ` AND o.order_date >= $${queryParams.length}`;
    }

    if (endDate) {
      queryParams.push(endDate);
      countQuery += ` AND o.order_date <= $${queryParams.length}`;
      selectQuery += ` AND o.order_date <= $${queryParams.length}`;
    }

    if (search && userRole === 'admin') {
      queryParams.push(`%${search}%`);
      countQuery += ` AND (u.name ILIKE $${queryParams.length} OR u.email ILIKE $${queryParams.length} OR u.department ILIKE $${queryParams.length})`;
      selectQuery += ` AND (u.name ILIKE $${queryParams.length} OR u.email ILIKE $${queryParams.length} OR u.department ILIKE $${queryParams.length})`;
    }

    // Count query execution
    const countRes = await db.query(countQuery, queryParams);
    const totalOrders = parseInt(countRes.rows[0].count);
    const totalPages = Math.ceil(totalOrders / limit);

    // Add ordering and pagination limits to select
    selectQuery += ` ORDER BY o.created_at DESC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
    queryParams.push(limit, offset);

    const ordersRes = await db.query(selectQuery, queryParams);

    res.json({
      orders: ordersRes.rows,
      pagination: {
        totalOrders,
        totalPages,
        currentPage: page,
        limit
      }
    });
  } catch (error) {
    next(error);
  }
};

// 4. Get Today's Orders (For current day)
exports.getTodayOrders = async (req, res, next) => {
  const userId = req.user.id;
  const userRole = req.user.role;
  const today = new Date().toISOString().split('T')[0];

  try {
    let result;
    if (userRole === 'admin') {
      // Admin sees everyone's today orders
      result = await db.query(`
        SELECT o.id, o.quantity, o.amount, o.status, o.created_at,
               u.name as employee_name, u.department,
               t.name as tea_name, t.price as unit_price
        FROM tea_orders o
        JOIN users u ON o.user_id = u.id
        JOIN tea_items t ON o.tea_item_id = t.id
        WHERE o.order_date = $1
        ORDER BY o.created_at DESC
      `, [today]);
    } else {
      // Employee sees only their own today's orders
      result = await db.query(`
        SELECT o.id, o.quantity, o.amount, o.status, o.created_at,
               t.name as tea_name, t.price as unit_price
        FROM tea_orders o
        JOIN tea_items t ON o.tea_item_id = t.id
        WHERE o.user_id = $1 AND o.order_date = $2
        ORDER BY o.created_at DESC
      `, [userId, today]);
    }

    res.json({
      date: today,
      orders: result.rows
    });
  } catch (error) {
    next(error);
  }
};

// 5. Load Dashboard Analytics & Live Data
exports.getDashboard = async (req, res, next) => {
  const userId = req.user.id;
  const userRole = req.user.role;
  const today = new Date().toISOString().split('T')[0];

  try {
    const windowStatus = await isOrderingOpen();
    const settingsRes = await db.query('SELECT key, value FROM settings');
    const settings = {};
    settingsRes.rows.forEach(r => {
      settings[r.key] = r.value;
    });

    const activeTeaItems = await db.query('SELECT id, name, price FROM tea_items WHERE is_available = true');

    if (userRole === 'admin') {
      // Admin Dashboard Details: Today's Orders item counts, total amount
      const statsRes = await db.query(`
        SELECT t.name as tea_name, 
               COALESCE(SUM(o.quantity), 0)::int as total_qty,
               COALESCE(SUM(o.amount), 0)::float as total_amt
        FROM tea_items t
        LEFT JOIN tea_orders o ON t.id = o.tea_item_id AND o.order_date = $1 AND o.status = 'ordered'
        GROUP BY t.id, t.name
      `, [today]);

      // Calculate total overall amount
      let grandTotal = 0;
      statsRes.rows.forEach(row => {
        grandTotal += row.total_amt;
      });

      // Get total employee count
      const empCountRes = await db.query('SELECT COUNT(*) FROM users WHERE role = \'employee\' AND is_active = true');

      res.json({
        role: 'admin',
        orderingWindow: {
          isOpen: windowStatus.open,
          message: windowStatus.message,
          teaTimeStart: settings['tea_time_start'],
          cutoffTime: settings['cutoff_time']
        },
        teaItems: activeTeaItems.rows,
        todayStats: statsRes.rows,
        grandTotalAmount: grandTotal,
        activeEmployeeCount: parseInt(empCountRes.rows[0].count)
      });
    } else {
      // Employee Dashboard Details: Today's order, and monthly summary
      const todayOrderRes = await db.query(`
        SELECT o.id, o.quantity, o.amount, o.status, t.name as tea_name
        FROM tea_orders o
        JOIN tea_items t ON o.tea_item_id = t.id
        WHERE o.user_id = $1 AND o.order_date = $2
        LIMIT 1
      `, [userId, today]);

      // Monthly spent details
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
      const monthlyRes = await db.query(`
        SELECT COALESCE(COUNT(id), 0)::int as total_orders,
               COALESCE(SUM(amount), 0)::float as total_amount
        FROM tea_orders
        WHERE user_id = $1 AND order_date >= $2 AND status = 'ordered'
      `, [userId, startOfMonth]);

      res.json({
        role: 'employee',
        orderingWindow: {
          isOpen: windowStatus.open,
          message: windowStatus.message,
          teaTimeStart: settings['tea_time_start'],
          cutoffTime: settings['cutoff_time']
        },
        teaItems: activeTeaItems.rows,
        todayOrder: todayOrderRes.rows.length > 0 ? todayOrderRes.rows[0] : null,
        monthlyStats: {
          totalOrders: monthlyRes.rows[0].total_orders,
          totalAmount: monthlyRes.rows[0].total_amount
        }
      });
    }
  } catch (error) {
    next(error);
  }
};

// 6. Update today's order (PUT /order)
exports.updateTodayOrder = async (req, res, next) => {
  const userId = req.user.id;
  const { teaItemId, quantity, status } = req.body;
  const today = new Date().toISOString().split('T')[0];

  try {
    // Check if ordering is open
    const statusCheck = await isOrderingOpen();
    if (!statusCheck.open) {
      return res.status(400).json({ error: statusCheck.message });
    }

    // Find today's order
    const orderRes = await db.query(
      'SELECT * FROM tea_orders WHERE user_id = $1 AND order_date = $2 AND status = \'ordered\'',
      [userId, today]
    );

    if (orderRes.rows.length === 0) {
      return res.status(404).json({ error: 'No active order found for today to update' });
    }

    const order = orderRes.rows[0];

    if (status === 'cancelled') {
      const updateRes = await db.query(
        'UPDATE tea_orders SET status = \'cancelled\' WHERE id = $1 RETURNING *',
        [order.id]
      );
      return res.json({ message: 'Order cancelled successfully', order: updateRes.rows[0] });
    }

    // Otherwise, we are updating quantity or teaItem
    const finalTeaItemId = teaItemId !== undefined ? teaItemId : order.tea_item_id;
    const finalQuantity = quantity !== undefined ? quantity : order.quantity;

    if (finalQuantity <= 0) {
      return res.status(400).json({ error: 'Quantity must be greater than 0' });
    }

    // Get item price
    const itemRes = await db.query('SELECT name, price, is_available FROM tea_items WHERE id = $1', [finalTeaItemId]);
    if (itemRes.rows.length === 0) {
      return res.status(404).json({ error: 'Tea item not found' });
    }
    const item = itemRes.rows[0];
    if (!item.is_available) {
      return res.status(400).json({ error: `${item.name} is currently not available` });
    }

    const finalAmount = Number(item.price) * Number(finalQuantity);

    const updateRes = await db.query(
      'UPDATE tea_orders SET tea_item_id = $1, quantity = $2, amount = $3 WHERE id = $4 RETURNING *',
      [finalTeaItemId, finalQuantity, finalAmount, order.id]
    );

    res.json({
      message: 'Order updated successfully',
      order: updateRes.rows[0],
      itemName: item.name
    });
  } catch (error) {
    next(error);
  }
};

