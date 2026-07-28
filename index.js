const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const db = require('./src/config/db');
const apiRoutes = require('./src/routes/api');
const { initCronJobs } = require('./src/services/cronService');
const errorHandler = require('./src/middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 5000;

// Security Middlewares
app.use(helmet());
app.use(cors({
  origin: '*', // Allow all origins for the mobile API
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body Parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Swagger API Documentation
const { swaggerUi, swaggerDocument } = require('./src/config/swagger');
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Serve API endpoints at both root and /api for consistency with specifications
app.use('/api', apiRoutes);
app.use('/', apiRoutes);

// Health Check Endpoint
app.get('/health', async (req, res) => {
  try {
    // Check DB health
    await db.query('SELECT 1');
    res.json({
      status: 'healthy',
      timestamp: new Date(),
      database: 'connected'
    });
  } catch (err) {
    res.status(500).json({
      status: 'unhealthy',
      error: err.message
    });
  }
});

// Centralized Error Handling Middleware
app.use(errorHandler);

// Start the server
app.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`Tea Time Management Backend is running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`===============================================`);
  
  // Initialize Daily Automated Alerts (4:55 PM & 5:10 PM schedulers)
  initCronJobs();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received. Shutting down gracefully...');
  db.pool.end(() => {
    console.log('Database pool has ended. Exiting.');
    process.exit(0);
  });
});
