const sql = require('mssql');
require('dotenv').config();

const config = {
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 1433,
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};

async function createDatabase() {
    try {
        console.log(`Connecting to SQL Server ${config.server}:${config.port} as ${config.user}...`);
        const pool = await sql.connect(config);
        const dbName = process.env.DB_NAME || 'TeaTime';
        
        console.log(`Checking if database '${dbName}' exists...`);
        const result = await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = '${dbName}')
            BEGIN
                CREATE DATABASE [${dbName}];
                SELECT 'CREATED' as status;
            END
            ELSE
            BEGIN
                SELECT 'EXISTS' as status;
            END
        `);
        
        if (result.recordset && result.recordset.length > 0) {
            console.log(`Status: Database ${result.recordset[0].status}`);
        }
        
        console.log('Done!');
        process.exit(0);
    } catch (err) {
        console.error('Error creating database:', err);
        process.exit(1);
    }
}

createDatabase();
