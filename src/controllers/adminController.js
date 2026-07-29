const db = require('../config/db');
const bcrypt = require('bcryptjs');

// 1. Employees Management
exports.getEmployees = async (req, res, next) => {
  const { search, role, department } = req.query;
  try {
    let query = 'SELECT id, name, email, role, department, is_active, created_at FROM users WHERE 1=1';
    const params = [];

    if (search) {
      params.push(`%${search}%`);
      query += ` AND (name ILIKE $${params.length} OR email ILIKE $${params.length} OR department ILIKE $${params.length})`;
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
  const { name, email, password, role, department } = req.body;
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

    const result = await db.query(
      'INSERT INTO users (name, email, password_hash, role, department) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, role, department, is_active, created_at',
      [name, trimmedEmail, passwordHash, role, department]
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
  const { name, email, role, department, is_active, password } = req.body;
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

    let updatedPasswordHash = currentEmp.password_hash;
    if (password) {
      updatedPasswordHash = await bcrypt.hash(password, 10);
    }

    const result = await db.query(
      'UPDATE users SET name = $1, email = $2, role = $3, department = $4, is_active = $5, password_hash = $6 WHERE id = $7 RETURNING id, name, email, role, department, is_active',
      [updatedName, updatedEmail, updatedRole, updatedDept, updatedIsActive, updatedPasswordHash, id]
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
  const { name, price, is_available } = req.body;
  try {
    if (!name || price === undefined) {
      return res.status(400).json({ error: 'Name and price are required' });
    }

    const checkExist = await db.query('SELECT id FROM tea_items WHERE name = $1', [name]);
    if (checkExist.rows.length > 0) {
      return res.status(400).json({ error: 'Tea item with this name already exists' });
    }

    const availableVal = is_available !== undefined ? is_available : true;

    const result = await db.query(
      'INSERT INTO tea_items (name, price, is_available) VALUES ($1, $2, $3) RETURNING *',
      [name, price, availableVal]
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
  const { name, price, is_available } = req.body;
  try {
    const itemRes = await db.query('SELECT * FROM tea_items WHERE id = $1', [id]);
    if (itemRes.rows.length === 0) {
      return res.status(404).json({ error: 'Tea item not found' });
    }

    const currentItem = itemRes.rows[0];
    const updatedName = name !== undefined ? name : currentItem.name;
    const updatedPrice = price !== undefined ? price : currentItem.price;
    const updatedAvailable = is_available !== undefined ? is_available : currentItem.is_available;

    const result = await db.query(
      'UPDATE tea_items SET name = $1, price = $2, is_available = $3 WHERE id = $4 RETURNING *',
      [updatedName, updatedPrice, updatedAvailable, id]
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
      await db.query('INSERT INTO settings (key, value) VALUES (\'tea_time_start\', $1) ON CONFLICT (key) DO UPDATE SET value = $1', [teaTimeStart]);
    }
    if (cutoffTime) {
      await db.query('INSERT INTO settings (key, value) VALUES (\'cutoff_time\', $1) ON CONFLICT (key) DO UPDATE SET value = $1', [cutoffTime]);
    }
    if (isOrderingOpen !== undefined) {
      const openVal = isOrderingOpen ? 'true' : 'false';
      await db.query('INSERT INTO settings (key, value) VALUES (\'is_ordering_open\', $1) ON CONFLICT (key) DO UPDATE SET value = $1', [openVal]);
    }

    // Return the updated settings
    const settingsRes = await db.query('SELECT key, value FROM settings');
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

// 4. Delete Tea/Coffee Item (Admin Only)
exports.deleteTeaItem = async (req, res, next) => {
  const { id } = req.params;
  try {
    const result = await db.query('DELETE FROM tea_items WHERE id = $1 RETURNING *', [id]);
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
    const result = await db.query('DELETE FROM users WHERE id = $1 RETURNING id, name, email', [id]);
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
