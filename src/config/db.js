const sql = require('mssql');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Ensure logs directory exists
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
    try {
        fs.mkdirSync(logsDir, { recursive: true });
    } catch (e) {
        console.error('Failed to create logs directory:', e.message);
    }
}
const logFilePath = path.join(logsDir, 'database.log');

const writeDbLog = (entry) => {
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] ${entry}\n`;
    try {
        fs.appendFileSync(logFilePath, logLine);
    } catch (e) {
        // Fallback gracefully if writing fails
    }
};

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
    const msg = `[DB CONNECTED] Connected to MSSQL Database (${config.database} @ ${config.server}:${config.port})`;
    console.log(msg);
    writeDbLog(msg);
    return pool;
  })
  .catch(err => {
    const msg = `[DB CONNECTION ERROR] Bad Config / Connection Failed: ${err.message}`;
    console.error(msg, err);
    writeDbLog(msg);
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

    const startTime = Date.now();
    const querySummary = mssqlText.replace(/\s+/g, ' ').trim();
    const paramsStr = params.length > 0 ? JSON.stringify(params) : 'None';

    try {
        const result = await request.query(mssqlText);
        const duration = Date.now() - startTime;
        const rowCount = result.rowsAffected ? result.rowsAffected[0] : (result.recordset ? result.recordset.length : 0);
        
        const successLog = `[DB QUERY SUCCESS] [${duration}ms] [Rows: ${rowCount}]\n  Query:  ${querySummary}\n  Params: ${paramsStr}`;
        console.log(`\x1b[36m[DB]\x1b[0m \x1b[32mSUCCESS\x1b[0m (${duration}ms | rows: ${rowCount}) -> ${querySummary}`);
        writeDbLog(successLog);

        return { 
            rows: result.recordset || [], 
            rowCount: result.rowsAffected ? result.rowsAffected[0] : 0 
        };
    } catch (err) {
        const duration = Date.now() - startTime;
        const errorLog = `[DB QUERY ERROR] [${duration}ms]\n  Query:  ${querySummary}\n  Params: ${paramsStr}\n  Error:  ${err.message}`;
        console.error(`\x1b[36m[DB]\x1b[0m \x1b[31mERROR\x1b[0m (${duration}ms) -> ${querySummary}\n  Error: ${err.message}`);
        writeDbLog(errorLog);
        throw err;
    }
};

module.exports = {
    query,
    poolPromise,
    sql,
    logFilePath
};


