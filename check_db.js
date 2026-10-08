const db = require('./src/config/db');

async function checkDatabase() {
    console.log('\n=============================================');
    console.log('       🔍 CHECKING DATABASE STATUS...       ');
    console.log('=============================================\n');

    try {
        // 1. Check basic connectivity & SQL Server version
        const versionResult = await db.query('SELECT @@VERSION AS version, DB_NAME() AS current_db');
        const dbName = versionResult.rows[0]?.current_db || 'Unknown';
        const version = versionResult.rows[0]?.version ? versionResult.rows[0].version.split('\n')[0] : 'Unknown';

        console.log(`✅ Connection Status: CONNECTED`);
        console.log(`📁 Database Name:     ${dbName}`);
        console.log(`🖥️  Server Version:    ${version}`);
        console.log('\n---------------------------------------------');
        console.log('📊 Table Record Counts:');
        console.log('---------------------------------------------');

        // 2. Check table counts
        const tables = [
            'users',
            'tea_items',
            'tea_orders',
            'settings',
            'notifications',
            'quantity_requests'
        ];

        for (const table of tables) {
            try {
                const countResult = await db.query(`SELECT COUNT(*) AS total FROM [${table}]`);
                const total = countResult.rows[0]?.total ?? 0;
                console.log(`  • ${table.padEnd(20)} : ${total} records`);
            } catch (err) {
                console.log(`  • ${table.padEnd(20)} : ⚠️ Not found / Error: ${err.message}`);
            }
        }

        // 3. Display quick sample data (Tea Items)
        console.log('\n---------------------------------------------');
        console.log('🍵 Available Tea Items:');
        console.log('---------------------------------------------');
        try {
            const itemsResult = await db.query('SELECT id, name, price, is_available FROM tea_items');
            if (itemsResult.rows.length === 0) {
                console.log('  (No items found in tea_items table)');
            } else {
                itemsResult.rows.forEach(item => {
                    const status = item.is_available ? 'Available' : 'Unavailable';
                    console.log(`  • [ID: ${item.id}] ${item.name.padEnd(12)} - ₹${item.price} (${status})`);
                });
            }
        } catch (err) {
            console.log('  ⚠️ Error querying tea_items:', err.message);
        }

        console.log('\n=============================================');
        console.log('   ✅ DATABASE CHECK COMPLETED SUCCESSFULLY!  ');
        console.log('=============================================\n');
        process.exit(0);
    } catch (error) {
        console.error('\n❌ DATABASE CHECK FAILED:', error.message);
        process.exit(1);
    }
}

checkDatabase();
