const db = require('../config/db');
const bcrypt = require('bcryptjs');

// 1. Employees Management
exports.getEmployees = async (req, res, next) => {
  const { search, role, department } = req.query;
  try {
    let query = 'SELECT id, name, email, role, department, is_active, can_select_cup_type, created_at FROM users WHERE 1=1';
    const params = [];

    if (search) {
      params.push(`%${search}%`);
      query += ` AND (name LIKE $${params.length} OR email LIKE $${params.length} OR department LIKE $${params.length})`;
    }
    if (role) {
      params.push(role);
      query += ` AND role = $${params.length}`;
    }
    if (department) {
      params.push(department);
      query += ` AND department = $${params.length}`;
    }

    query += ' ORDER BY name ASC';
    const result = await db.query(query, params);
    res.json({ employees: result.rows });
  } catch (error) {
    next(error);
  }
};

exports.createEmployee = async (req, res, next) => {
  const { name, email, password, role, department, can_select_cup_type } = req.body;
  try {
    if (!name || !email || !password || !role || !department) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const trimmedEmail = email.trim().toLowerCase();

    // Check email uniqueness
    const userExist = await db.query('SELECT id FROM users WHERE email = $1', [trimmedEmail]);
    if (userExist.rows.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const cupTypeVal = can_select_cup_type !== undefined ? can_select_cup_type : false;

    const result = await db.query(
      'INSERT INTO users (name, email, password_hash, role, department, can_select_cup_type) OUTPUT inserted.id, inserted.name, inserted.email, inserted.role, inserted.department, inserted.is_active, inserted.can_select_cup_type, inserted.created_at VALUES ($1, $2, $3, $4, $5, $6)',
      [name, trimmedEmail, passwordHash, role, department, cupTypeVal]
    );

    res.status(201).json({
      message: 'Employee created successfully',
      employee: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

exports.updateEmployee = async (req, res, next) => {
  const { id } = req.params;
  const { name, email, role, department, is_active, password, can_select_cup_type } = req.body;
  try {
    // Check if employee exists
    const empRes = await db.query('SELECT * FROM users WHERE id = $1', [id]);
    if (empRes.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const currentEmp = empRes.rows[0];
    const updatedName = name !== undefined ? name : currentEmp.name;
    const updatedEmail = email !== undefined ? email.trim().toLowerCase() : currentEmp.email;
    const updatedRole = role !== undefined ? role : currentEmp.role;
    const updatedDept = department !== undefined ? department : currentEmp.department;
    const updatedIsActive = is_active !== undefined ? is_active : currentEmp.is_active;
    const updatedCanSelectCupType = can_select_cup_type !== undefined ? can_select_cup_type : currentEmp.can_select_cup_type;

    let updatedPasswordHash = currentEmp.password_hash;
    if (password) {
      updatedPasswordHash = await bcrypt.hash(password, 10);
    }

    const result = await db.query(
      'UPDATE users SET name = $1, email = $2, role = $3, department = $4, is_active = $5, password_hash = $6, can_select_cup_type = $7 OUTPUT inserted.id, inserted.name, inserted.email, inserted.role, inserted.department, inserted.is_active, inserted.can_select_cup_type WHERE id = $8',
      [updatedName, updatedEmail, updatedRole, updatedDept, updatedIsActive, updatedPasswordHash, updatedCanSelectCupType, id]
    );

    res.json({
      message: 'Employee updated successfully',
      employee: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

// 2. Tea Master Management (Prices & availability)
exports.getTeaItems = async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM tea_items ORDER BY id ASC');
    res.json({ teaItems: result.rows });
  } catch (error) {
    next(error);
  }
};

exports.createTeaItem = async (req, res, next) => {
  const { name, price, is_available, item_type } = req.body;
  try {
    if (!name || price === undefined) {
      return res.status(400).json({ error: 'Name and price are required' });
    }

    const checkExist = await db.query('SELECT id FROM tea_items WHERE name = $1', [name]);
    if (checkExist.rows.length > 0) {
      return res.status(400).json({ error: 'Tea item with this name already exists' });
    }

    const availableVal = is_available !== undefined ? is_available : true;
    const itemTypeVal = item_type && ['drink', 'snack'].includes(item_type) ? item_type : 'drink';

    const result = await db.query(
      'INSERT INTO tea_items (name, price, is_available, item_type) OUTPUT inserted.* VALUES ($1, $2, $3, $4)',
      [name, price, availableVal, itemTypeVal]
    );

    res.status(201).json({
      message: 'Tea item created successfully',
      teaItem: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

exports.updateTeaItem = async (req, res, next) => {
  const { id } = req.params;
  const { name, price, is_available, item_type } = req.body;
  try {
    const itemRes = await db.query('SELECT * FROM tea_items WHERE id = $1', [id]);
    if (itemRes.rows.length === 0) {
      return res.status(404).json({ error: 'Tea item not found' });
    }

    const currentItem = itemRes.rows[0];
    const updatedName = name !== undefined ? name : currentItem.name;
    const updatedPrice = price !== undefined ? price : currentItem.price;
    const updatedAvailable = is_available !== undefined ? is_available : currentItem.is_available;
    const updatedItemType = item_type && ['drink', 'snack'].includes(item_type) ? item_type : currentItem.item_type;

    const result = await db.query(
      'UPDATE tea_items SET name = $1, price = $2, is_available = $3, item_type = $4 OUTPUT inserted.* WHERE id = $5',
      [updatedName, updatedPrice, updatedAvailable, updatedItemType, id]
    );

    res.json({
      message: 'Tea item updated successfully',
      teaItem: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

// 3. Settings Management
exports.updateSettings = async (req, res, next) => {
  const { teaTimeStart, cutoffTime, isOrderingOpen } = req.body;
  try {
    if (teaTimeStart) {
      await db.query(`
        IF EXISTS (SELECT 1 FROM settings WHERE [key] = 'tea_time_start')
          UPDATE settings SET value = $1 WHERE [key] = 'tea_time_start'
        ELSE
          INSERT INTO settings ([key], value) VALUES ('tea_time_start', $1)
      `, [teaTimeStart]);
    }
    if (cutoffTime) {
      await db.query(`
        IF EXISTS (SELECT 1 FROM settings WHERE [key] = 'cutoff_time')
          UPDATE settings SET value = $1 WHERE [key] = 'cutoff_time'
        ELSE
          INSERT INTO settings ([key], value) VALUES ('cutoff_time', $1)
      `, [cutoffTime]);
    }
    if (isOrderingOpen !== undefined) {
      const openVal = isOrderingOpen ? 'true' : 'false';
      await db.query(`
        IF EXISTS (SELECT 1 FROM settings WHERE [key] = 'is_ordering_open')
          UPDATE settings SET value = $1 WHERE [key] = 'is_ordering_open'
        ELSE
          INSERT INTO settings ([key], value) VALUES ('is_ordering_open', $1)
      `, [openVal]);
    }

    // Return the updated settings
    const settingsRes = await db.query('SELECT [key], value FROM settings');
    const settingsObj = {};
    settingsRes.rows.forEach(r => {
      settingsObj[r.key] = r.value;
    });

    res.json({
      message: 'Settings updated successfully',
      settings: settingsObj
    });
  } catch (error) {
    next(error);
  }
};

// 3b. Admin Force Toggle — Force open or close ordering window
exports.forceToggle = async (req, res, next) => {
  const { action } = req.body; // action: 'open' | 'closed' | 'auto'
  try {
    if (!['open', 'closed', 'auto'].includes(action)) {
      return res.status(400).json({ error: 'action must be open, closed, or auto' });
    }

    if (action === 'auto') {
      // Remove manual override — revert to time-based auto
      await db.query('DELETE FROM settings WHERE [key] = \'manual_override\'');
    } else {
      await db.query(`
        IF EXISTS (SELECT 1 FROM settings WHERE [key] = 'manual_override')
          UPDATE settings SET value = $1 WHERE [key] = 'manual_override'
        ELSE
          INSERT INTO settings ([key], value) VALUES ('manual_override', $1)
      `, [action]);
    }

    const label = action === 'open' ? 'Force opened' : action === 'closed' ? 'Force closed' : 'Reverted to auto (time-based)';
    res.json({ message: label, action });
  } catch (error) {
    next(error);
  }
};

// 4. Delete Tea/Coffee Item (Admin Only)
exports.deleteTeaItem = async (req, res, next) => {
  const { id } = req.params;
  try {
    const result = await db.query('DELETE FROM tea_items OUTPUT deleted.* WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Beverage item not found' });
    }
    res.json({
      message: 'Beverage item deleted successfully',
      teaItem: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

// 5. Delete Employee Account (Admin Only)
exports.deleteEmployee = async (req, res, next) => {
  const { id } = req.params;
  try {
    const result = await db.query('DELETE FROM users OUTPUT deleted.id, deleted.name, deleted.email WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    res.json({
      message: 'Employee account deleted successfully',
      employee: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
};
