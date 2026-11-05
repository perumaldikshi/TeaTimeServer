const db = require('../config/db');
const notificationService = require('../services/notificationService');

// Helper to check if ordering window is currently open (imported from orderController logic)
const getLocalTimeVal = () => {
  const tz = process.env.APP_TIMEZONE || process.env.TZ || 'Asia/Kolkata';
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: 'numeric',
    minute: 'numeric',
    hour12: false
  });
  const parts = formatter.formatToParts(new Date());
  const hour = parseInt(parts.find(p => p.type === 'hour').value, 10) % 24;
  const minute = parseInt(parts.find(p => p.type === 'minute').value, 10);
  return hour * 60 + minute;
};

const isOrderingOpen = async () => {
  try {
    const settingsRes = await db.query('SELECT [key], value FROM settings');
    const settings = {};
    settingsRes.rows.forEach(r => {
      settings[r.key] = r.value;
    });

    const override = settings['manual_override'];
    if (override === 'open') {
      return { open: true, message: 'Ordering is open (Admin Override)', override: 'open' };
    }
    if (override === 'closed') {
      return { open: false, message: 'Ordering closed (Admin Override)', override: 'closed' };
    }

    const currentTimeVal = getLocalTimeVal();
    const [startH, startM] = (settings['tea_time_start'] || '16:30').split(':').map(Number);
    const [cutoffH, cutoffM] = (settings['cutoff_time'] || '17:10').split(':').map(Number);
    const startTimeVal = startH * 60 + startM;
    const cutoffTimeVal = cutoffH * 60 + cutoffM;

    if (currentTimeVal >= startTimeVal && currentTimeVal <= cutoffTimeVal) {
      return { open: true, message: 'Ordering is open', override: null };
    }

    return { open: false, message: 'Ordering Closed', override: null };
  } catch (err) {
    console.error('Error checking ordering window:', err);
    return { open: false, message: 'Error checking ordering window', override: null };
  }
};

// 1. Get available colleague items
exports.getAvailableSnacks = async (req, res, next) => {
  try {
    const snacksRes = await db.query(`
      SELECT id, name, price, is_available, item_type, COALESCE(category, 'common') AS category 
      FROM tea_items 
      WHERE category = 'colleague' AND is_available = 1 AND (is_deleted = 0 OR is_deleted IS NULL)
      ORDER BY name ASC
    `);
    res.json({ snacks: snacksRes.rows });
  } catch (error) {
    next(error);
  }
};

// 2. Get list of active colleagues to share snacks with (excludes users with active shared order today)
exports.getColleagues = async (req, res, next) => {
  const currentUserId = req.user.id;
  const today = new Date().toISOString().split('T')[0];
  try {
    const usersRes = await db.query(`
      SELECT id, name, email, department 
      FROM users 
      WHERE role = 'employee' 
        AND is_active = 1 
        AND id != $1
        AND id NOT IN (
          SELECT primary_user_id 
          FROM shared_snack_orders 
          WHERE order_date = $2 AND status = 'ordered'
          UNION
          SELECT shared_user_id 
          FROM shared_snack_orders 
          WHERE order_date = $2 AND status = 'ordered'
        )
      ORDER BY name ASC
    `, [currentUserId, today]);
    res.json({ colleagues: usersRes.rows });
  } catch (error) {
    next(error);
  }
};

// 3. Get active shared snack order for current user for today's session
exports.getActiveSharedSnack = async (req, res, next) => {
  const userId = req.user.id;
  const today = new Date().toISOString().split('T')[0];

  try {
    const result = await db.query(`
      SELECT s.id, s.tea_item_id, s.primary_user_id, s.shared_user_id,
             s.primary_quantity, s.shared_quantity, s.additional_quantity,
             s.total_quantity, s.unit_price, s.amount, s.status, s.order_date, s.created_at,
             t.name AS snack_name, t.price AS original_price,
             u1.name AS primary_user_name, u1.email AS primary_user_email, u1.department AS primary_user_department,
             u2.name AS shared_user_name, u2.email AS shared_user_email, u2.department AS shared_user_department
      FROM shared_snack_orders s
      JOIN tea_items t ON s.tea_item_id = t.id
      JOIN users u1 ON s.primary_user_id = u1.id
      LEFT JOIN users u2 ON s.shared_user_id = u2.id
      WHERE (s.primary_user_id = $1 OR s.shared_user_id = $1)
        AND s.order_date = $2
        AND s.status = 'ordered'
    `, [userId, today]);

    if (result.rows.length === 0) {
      return res.json({
        hasActiveOrder: false,
        order: null
      });
    }

    const order = result.rows[0];
    const isInitiator = order.primary_user_id === userId;
    const isSelf = !order.shared_user_id;

    res.json({
      hasActiveOrder: true,
      isInitiator,
      isSelf,
      order: {
        ...order,
        isSelf,
        breakdown: {
          primaryQuantity: order.primary_quantity,
          sharedQuantity: order.shared_quantity,
          additionalQuantity: order.additional_quantity,
          totalQuantity: order.total_quantity,
          description: isSelf
            ? `${order.primary_user_name} (Self - ${order.total_quantity} Qty)`
            : `${order.primary_user_name} & ${order.shared_user_name || ''} (${order.total_quantity} Qty)`
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// 4. Place shared snack order
// Quantity logic:
//   Employee 1 (primary) = 1
//   Employee 2 (shared colleague) = 1
//   Additional shared = 1
//   Total Quantity = 3
// Duplicate prevention:
//   Maintain single shared record in shared_snack_orders for this session (today).
exports.placeSharedSnackOrder = async (req, res, next) => {
  const primaryUserId = req.user.id;
  const { teaItemId, sharedWithUserId, orderMode } = req.body;
  const isSelf = orderMode === 'self' || !sharedWithUserId;
  const today = new Date().toISOString().split('T')[0];

  try {
    if (!teaItemId) {
      return res.status(400).json({ error: 'Snack item is required' });
    }

    if (!isSelf) {
      if (parseInt(primaryUserId, 10) === parseInt(sharedWithUserId, 10)) {
        return res.status(400).json({ error: 'You cannot share snacks with yourself. Please select a colleague or choose Order for Self.' });
      }
    }

    // Check if ordering is open
    const status = await isOrderingOpen();
    if (!status.open) {
      return res.status(400).json({ error: status.message });
    }

    // Validate colleague item
    const itemRes = await db.query(
      "SELECT id, name, price, is_available, item_type, COALESCE(category, 'common') AS category FROM tea_items WHERE id = $1 AND (is_deleted = 0 OR is_deleted IS NULL)",
      [teaItemId]
    );
    if (itemRes.rows.length === 0) {
      return res.status(404).json({ error: 'Selected item not found' });
    }
    const item = itemRes.rows[0];
    if (!item.is_available) {
      return res.status(400).json({ error: `${item.name} is currently not available` });
    }
    if (item.category !== 'colleague') {
      return res.status(400).json({ error: 'Selected item is not a colleague item' });
    }

    let colleague = null;
    if (!isSelf) {
      // Validate colleague
      const colleagueRes = await db.query(
        'SELECT id, name, email FROM users WHERE id = $1 AND role = \'employee\' AND is_active = 1',
        [sharedWithUserId]
      );
      if (colleagueRes.rows.length === 0) {
        return res.status(404).json({ error: 'Selected colleague not found or inactive' });
      }
      colleague = colleagueRes.rows[0];
    }

    // Check Duplicate Order:
    // 1. Primary user must not already have an active shared/solo snack today
    const primaryExisting = await db.query(`
      SELECT id FROM shared_snack_orders 
      WHERE (primary_user_id = $1 OR shared_user_id = $1)
        AND order_date = $2 
        AND status = 'ordered'
    `, [primaryUserId, today]);

    if (primaryExisting.rows.length > 0) {
      return res.status(400).json({ 
        error: 'You already have an active snack order for today\'s session. Duplicate orders are not allowed.' 
      });
    }

    // 2. Colleague must not already have an active snack today
    if (!isSelf && sharedWithUserId) {
      const colleagueExisting = await db.query(`
        SELECT id FROM shared_snack_orders 
        WHERE (primary_user_id = $1 OR shared_user_id = $1)
          AND order_date = $2 
          AND status = 'ordered'
      `, [sharedWithUserId, today]);

      if (colleagueExisting.rows.length > 0) {
        return res.status(400).json({ 
          error: `${colleague.name} already has an active shared snack order for today's session.` 
        });
      }
    }

    // Default quantity is 1
    const primaryQuantity = 1;
    const sharedQuantity = isSelf ? 0 : 1;
    const additionalQuantity = 0;
    const totalQuantity = 1;
    const unitPrice = Number(item.price);
    const totalAmount = unitPrice * totalQuantity;

    // Insert into shared_snack_orders (shared_user_id can be NULL for solo self orders)
    const insertRes = await db.query(`
      INSERT INTO shared_snack_orders (
        tea_item_id, primary_user_id, shared_user_id,
        primary_quantity, shared_quantity, additional_quantity,
        total_quantity, unit_price, amount, status, order_date
      ) OUTPUT inserted.*
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'ordered', $10)
    `, [
      teaItemId,
      primaryUserId,
      isSelf ? null : sharedWithUserId,
      primaryQuantity,
      sharedQuantity,
      additionalQuantity,
      totalQuantity,
      unitPrice,
      totalAmount,
      today
    ]);

    const createdOrder = insertRes.rows[0];

    // Create in-app notification for Employee 2 if shared
    if (!isSelf && sharedWithUserId) {
      try {
        await db.query(`
          INSERT INTO notifications (title, body, user_id)
          VALUES ($1, $2, $3)
        `, [
          '🥨 Snacks Shared with You!',
          `${req.user.name} shared ${item.name} with you for today's TeaTime session (${totalQuantity} Qty).`,
          sharedWithUserId
        ]);
      } catch (notifErr) {
        console.warn('Failed to insert shared snack notification:', notifErr.message);
      }
    }

    res.status(201).json({
      message: isSelf 
        ? 'Snack order placed successfully for yourself for today\'s session.'
        : `Snack order shared successfully with ${colleague.name} for today's session.`,
      order: {
        ...createdOrder,
        snack_name: item.name,
        primary_user_name: req.user.name,
        shared_user_name: colleague ? colleague.name : null,
        isSelf,
        breakdown: {
          primaryQuantity,
          sharedQuantity,
          additionalQuantity,
          totalQuantity
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// 5. Cancel shared snack order
exports.cancelSharedSnackOrder = async (req, res, next) => {
  const orderId = req.params.id;
  const userId = req.user.id;
  const userRole = req.user.role;

  try {
    if (userRole !== 'admin') {
      const status = await isOrderingOpen();
      if (!status.open) {
        return res.status(400).json({ error: 'Ordering is closed. Cannot cancel shared snack order after cutoff time.' });
      }
    }

    const orderRes = await db.query('SELECT * FROM shared_snack_orders WHERE id = $1', [orderId]);
    if (orderRes.rows.length === 0) {
      return res.status(404).json({ error: 'Shared snack order not found' });
    }

    const order = orderRes.rows[0];

    if (userRole !== 'admin' && order.primary_user_id !== userId) {
      return res.status(403).json({ error: 'Only the employee who initiated the shared snack order (or Admin) can cancel it.' });
    }

    if (order.status === 'cancelled') {
      return res.status(400).json({ error: 'Shared snack order is already cancelled' });
    }

    const updateRes = await db.query(
      'UPDATE shared_snack_orders SET status = \'cancelled\' OUTPUT inserted.* WHERE id = $1',
      [orderId]
    );

    // Notify shared colleague (if shared order)
    if (order.shared_user_id) {
      try {
        await db.query(`
          INSERT INTO notifications (title, body, user_id)
          VALUES ($1, $2, $3)
        `, [
          '🥨 Shared Snack Order Cancelled',
          `${req.user.name} cancelled the shared snack order for today's session.`,
          order.shared_user_id
        ]);
      } catch (e) {
        // Ignored
      }
    }

    res.json({
      message: 'Shared snack order cancelled successfully',
      order: updateRes.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

