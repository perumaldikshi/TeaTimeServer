const sql = require('mssql');
require('dotenv').config();

const config = {
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER || 'localhost', 
    database: process.env.DB_NAME || 'TeaTime',
    port: parseInt(process.env.DB_PORT, 10) || 1433,
    options: {
        encrypt: false,
        trustServerCertificate: true,
        useUTC: false
    },
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    }
};

const poolPromise = new sql.ConnectionPool(config)
  .connect()
  .then(pool => {
    console.log('Connected to MSSQL Database pool.');
    return pool;
  })
  .catch(err => {
    console.error('Database Connection Failed! Bad Config: ', err);
    process.exit(-1);
  });

const query = async (text, params = []) => {
    const pool = await poolPromise;
    const request = pool.request();
    
    let mssqlText = text;
    
    // Replace $1, $2 with @p1, @p2
    params.forEach((param, index) => {
        const paramName = `p${index + 1}`;
        request.input(paramName, param);
        
        const regex = new RegExp(`\\$${index + 1}\\b`, 'g');
        mssqlText = mssqlText.replace(regex, `@${paramName}`);
    });

    try {
        const result = await request.query(mssqlText);
        return { 
            rows: result.recordset || [], 
            rowCount: result.rowsAffected ? result.rowsAffected[0] : 0 
        };
    } catch (err) {
        console.error('SQL Error on query:', mssqlText);
        throw err;
    }
};

module.exports = {
    query,
    poolPromise,
    sql
};

