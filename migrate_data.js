const { Pool } = require('pg');
const sql = require('mssql');
require('dotenv').config();

// Postgres Config
const pgPool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_sFYdKRfP3Jn0@ep-restless-mud-aylpl929.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

// MSSQL Config
const mssqlConfig = {
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER || 'localhost',
    database: process.env.DB_NAME || 'TeaTime',
    port: parseInt(process.env.DB_PORT, 10) || 1433,
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};

async function migrateData() {
    console.log("Starting Data Migration from Neon (PostgreSQL) to SQL Server Express...");
    let mssqlPool;
    
    try {
        mssqlPool = await sql.connect(mssqlConfig);
        console.log("Connected to MSSQL.");
        
        // 1. Settings
        const { rows: settings } = await pgPool.query('SELECT * FROM settings');
        for(let s of settings) {
            await mssqlPool.request()
                .input('key', sql.VarChar, s.key)
                .input('value', sql.VarChar, s.value)
                .input('updated_at', sql.DateTime, s.updated_at)
                .query('IF NOT EXISTS (SELECT 1 FROM settings WHERE [key]=@key) INSERT INTO settings ([key], value, updated_at) VALUES (@key, @value, @updated_at) ELSE UPDATE settings SET value=@value, updated_at=@updated_at WHERE [key]=@key');
        }
        console.log(`Migrated ${settings.length} settings.`);
        
        // 2. Users
        const { rows: users } = await pgPool.query('SELECT * FROM users');
        if(users.length > 0) {
            for(let u of users) {
                await mssqlPool.request()
                    .input('id', sql.Int, u.id)
                    .input('name', sql.VarChar, u.name)
                    .input('email', sql.VarChar, u.email)
                    .input('password_hash', sql.VarChar, u.password_hash)
                    .input('role', sql.VarChar, u.role)
                    .input('department', sql.VarChar, u.department)
                    .input('fcm_token', sql.VarChar, u.fcm_token)
                    .input('token_version', sql.Int, u.token_version)
                    .input('allowed_quantity', sql.Int, u.allowed_quantity)
                    .input('is_active', sql.Bit, u.is_active)
                    .input('can_select_cup_type', sql.Bit, u.can_select_cup_type || 0)
                    .input('created_at', sql.DateTime, u.created_at)
                    .query(`SET IDENTITY_INSERT users ON;
                            IF NOT EXISTS (SELECT 1 FROM users WHERE id=@id) 
                            INSERT INTO users (id, name, email, password_hash, role, department, fcm_token, token_version, allowed_quantity, is_active, can_select_cup_type, created_at) 
                            VALUES (@id, @name, @email, @password_hash, @role, @department, @fcm_token, @token_version, @allowed_quantity, @is_active, @can_select_cup_type, @created_at);
                            SET IDENTITY_INSERT users OFF;`);
            }
        }
        console.log(`Migrated ${users.length} users.`);
        
        // 3. Tea Items
        const { rows: items } = await pgPool.query('SELECT * FROM tea_items');
        if(items.length > 0) {
            for(let i of items) {
                await mssqlPool.request()
                    .input('id', sql.Int, i.id)
                    .input('name', sql.VarChar, i.name)
                    .input('price', sql.Decimal(10,2), i.price)
                    .input('is_available', sql.Bit, i.is_available)
                    .input('item_type', sql.VarChar, i.item_type)
                    .input('created_at', sql.DateTime, i.created_at)
                    .query(`SET IDENTITY_INSERT tea_items ON;
                            IF NOT EXISTS (SELECT 1 FROM tea_items WHERE id=@id) 
                            INSERT INTO tea_items (id, name, price, is_available, item_type, created_at) 
                            VALUES (@id, @name, @price, @is_available, @item_type, @created_at);
                            SET IDENTITY_INSERT tea_items OFF;`);
            }
        }
        console.log(`Migrated ${items.length} tea_items.`);
        
        // 4. Tea Orders
        const { rows: orders } = await pgPool.query('SELECT * FROM tea_orders');
        if(orders.length > 0) {
            for(let o of orders) {
                await mssqlPool.request()
                    .input('id', sql.Int, o.id)
                    .input('user_id', sql.Int, o.user_id)
                    .input('tea_item_id', sql.Int, o.tea_item_id)
                    .input('quantity', sql.Int, o.quantity)
                    .input('amount', sql.Decimal(10,2), o.amount)
                    .input('status', sql.VarChar, o.status)
                    .input('sugar_preference', sql.VarChar, o.sugar_preference)
                    .input('cup_type', sql.VarChar, o.cup_type)
                    .input('order_date', sql.Date, o.order_date)
                    .input('created_at', sql.DateTime, o.created_at)
                    .query(`SET IDENTITY_INSERT tea_orders ON;
                            IF NOT EXISTS (SELECT 1 FROM tea_orders WHERE id=@id) 
                            INSERT INTO tea_orders (id, user_id, tea_item_id, quantity, amount, status, sugar_preference, cup_type, order_date, created_at) 
                            VALUES (@id, @user_id, @tea_item_id, @quantity, @amount, @status, @sugar_preference, @cup_type, @order_date, @created_at);
                            SET IDENTITY_INSERT tea_orders OFF;`);
            }
        }
        console.log(`Migrated ${orders.length} tea_orders.`);
        
        // 5. Notifications
        const { rows: notifs } = await pgPool.query('SELECT * FROM notifications');
        if(notifs.length > 0) {
            for(let n of notifs) {
                await mssqlPool.request()
                    .input('id', sql.Int, n.id)
                    .input('title', sql.VarChar, n.title)
                    .input('body', sql.Text, n.body)
                    .input('user_id', sql.Int, n.user_id)
                    .input('sent_at', sql.DateTime, n.sent_at)
                    .query(`SET IDENTITY_INSERT notifications ON;
                            IF NOT EXISTS (SELECT 1 FROM notifications WHERE id=@id) 
                            INSERT INTO notifications (id, title, body, user_id, sent_at) 
                            VALUES (@id, @title, @body, @user_id, @sent_at);
                            SET IDENTITY_INSERT notifications OFF;`);
            }
        }
        console.log(`Migrated ${notifs.length} notifications.`);
        
        // 6. Quantity Requests
        try {
            const { rows: reqs } = await pgPool.query('SELECT * FROM quantity_requests');
            if(reqs.length > 0) {
                for(let r of reqs) {
                    await mssqlPool.request()
                        .input('id', sql.Int, r.id)
                        .input('user_id', sql.Int, r.user_id)
                        .input('requested_quantity', sql.Int, r.requested_quantity)
                        .input('status', sql.VarChar, r.status)
                        .input('created_at', sql.DateTime, r.created_at)
                        .query(`SET IDENTITY_INSERT quantity_requests ON;
                                IF NOT EXISTS (SELECT 1 FROM quantity_requests WHERE id=@id) 
                                INSERT INTO quantity_requests (id, user_id, requested_quantity, status, created_at) 
                                VALUES (@id, @user_id, @requested_quantity, @status, @created_at);
                                SET IDENTITY_INSERT quantity_requests OFF;`);
                }
            }
            console.log(`Migrated ${reqs.length} quantity_requests.`);
        } catch(err) {
            console.log('quantity_requests table not found in pg, skipping.', err.message);
        }
        
        console.log("Migration Complete!");
        
        // Resync identity columns (so next inserts work correctly)
        const tables = ['users', 'tea_items', 'tea_orders', 'notifications', 'quantity_requests'];
        for(let table of tables) {
            try {
                await mssqlPool.request().query(`
                    DECLARE @max_id INT;
                    SELECT @max_id = ISNULL(MAX(id), 0) FROM ${table};
                    IF @max_id > 0
                        DBCC CHECKIDENT ('${table}', RESEED, @max_id);
                `);
            } catch(e) { }
        }

    } catch(err) {
        console.error("Migration Failed: ", err);
    } finally {
        await pgPool.end();
        if(mssqlPool) await mssqlPool.close();
        process.exit(0);
    }
}

migrateData();
