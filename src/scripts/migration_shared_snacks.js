const db = require('../config/db');
const bcrypt = require('bcryptjs');

async function runMigration() {
  console.log('--- Running Shared Snacks Migration ---');
  try {
    // 1. Create shared_snack_orders table if not exists
    const createTableQuery = `
      IF OBJECT_ID('dbo.shared_snack_orders', 'U') IS NULL
      BEGIN
          CREATE TABLE shared_snack_orders (
              id INT IDENTITY(1,1) PRIMARY KEY,
              tea_item_id INT REFERENCES tea_items(id) NOT NULL,
              primary_user_id INT REFERENCES users(id) NOT NULL,
              shared_user_id INT REFERENCES users(id) NOT NULL,
              primary_quantity INT DEFAULT 1 NOT NULL,
              shared_quantity INT DEFAULT 1 NOT NULL,
              additional_quantity INT DEFAULT 1 NOT NULL,
              total_quantity INT DEFAULT 3 NOT NULL,
              unit_price DECIMAL(10, 2) NOT NULL,
              amount DECIMAL(10, 2) NOT NULL,
              status VARCHAR(20) DEFAULT 'ordered' CHECK (status IN ('ordered', 'cancelled')),
              order_date DATE DEFAULT CAST(GETDATE() AS DATE),
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          );

          CREATE INDEX idx_sso_date ON shared_snack_orders(order_date);
          CREATE INDEX idx_sso_primary_user ON shared_snack_orders(primary_user_id);
          CREATE INDEX idx_sso_shared_user ON shared_snack_orders(shared_user_id);
          CREATE INDEX idx_sso_status ON shared_snack_orders(status);
          PRINT 'Table shared_snack_orders created successfully.';
      END
      ELSE
      BEGIN
          PRINT 'Table shared_snack_orders already exists.';
      END
    `;
    await db.query(createTableQuery);
    console.log('✅ Table shared_snack_orders checked/created.');

    // 2. Ensure Employee 2 exists for testing
    // Employee 1 is John Doe (employee@teatime.com, id: 2)
    // Check if employee2@teatime.com exists
    const checkEmp2 = await db.query("SELECT id, name, email FROM users WHERE email = 'employee2@teatime.com'");
    if (checkEmp2.rows.length === 0) {
      const passwordHash = await bcrypt.hash('employee123', 10);
      const insertEmp2 = await db.query(`
        INSERT INTO users (name, email, password_hash, role, department, allowed_quantity, is_active, can_select_cup_type, can_view_all_orders)
        OUTPUT inserted.id, inserted.name, inserted.email
        VALUES ('Jane Doe (Employee 2)', 'employee2@teatime.com', $1, 'employee', 'Design', 1, 1, 1, 1)
      `, [passwordHash]);
      console.log('✅ Created Employee 2 account:', insertEmp2.rows[0]);
    } else {
      console.log('ℹ️ Employee 2 account already exists:', checkEmp2.rows[0]);
    }

    // 3. Ensure snack items have item_type = 'snack'
    await db.query(`
      UPDATE tea_items 
      SET item_type = 'snack' 
      WHERE name LIKE '%biscuit%' OR name LIKE '%snack%'
    `);
    console.log('✅ Updated snack item_types.');

    console.log('--- Migration Finished Successfully ---');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
}

runMigration();

