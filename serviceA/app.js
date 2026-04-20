const express = require('express');
const cors = require('cors');
const winston = require('winston');
const axios = require('axios');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/serviceA.log' })
  ],
});

app.use((req, res, next) => {
  logger.info(`Incoming request on ${req.originalUrl}`);
  next();
});

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASS,
  port: process.env.DB_PORT,
});

// Validate environment variables on startup
const requiredEnvVars = ['DB_USER', 'DB_HOST', 'DB_NAME', 'DB_PASS', 'DB_PORT', 'SERVICE_B_URL'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
  logger.error(`Missing required environment variables: ${missingVars.join(', ')}`);
  process.exit(1);
}

app.get('/serviceA', async (req, res) => {
  const requestId = `req-${Date.now()}`;
  
  try {
    logger.info({ requestId, message: "Service A calling Service B", url: process.env.SERVICE_B_URL });

    const response = await axios.get(process.env.SERVICE_B_URL, {
      timeout: 5000,
      headers: { 'X-Request-ID': requestId }
    });
    
    logger.info({ requestId, message: "Response from Service B received", data: response.data });

    const result = await pool.query('SELECT NOW()');
    logger.info({ requestId, message: 'Database query successful', time: result.rows[0].now });

    res.send(response.data);
  } catch (err) {
    logger.error({ 
      requestId,
      message: 'Error in Service A',
      error: err.message,
      stack: err.stack,
      code: err.code,
      serviceCalled: process.env.SERVICE_B_URL,
      responseStatus: err.response?.status,
      responseData: err.response?.data
    });

    // Send user-friendly error response
    if (err.code === 'ECONNREFUSED') {
      return res.status(503).json({ 
        error: 'Service B is unavailable',
        message: 'The service is temporarily down. Please try again later.',
        requestId 
      });
    }

    if (err.response?.status === 500) {
      return res.status(500).json({ 
        error: 'Downstream service error',
        message: 'An error occurred in a downstream service.',
        requestId 
      });
    }

    if (err.code === 'ENOTFOUND' || err.code === 'EAI_AGAIN') {
      return res.status(503).json({ 
        error: 'Service discovery failed',
        message: 'Unable to locate the required service.',
        requestId 
      });
    }

    res.status(500).json({ 
      error: 'Internal Server Error',
      message: 'An unexpected error occurred.',
      requestId 
    });
  }
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'healthy', service: 'Service A', timestamp: new Date().toISOString() });
  } catch (err) {
    logger.error('Health check failed', { error: err.message });
    res.status(503).json({ status: 'unhealthy', service: 'Service A', error: err.message });
  }
});

app.listen(port, () => {
  logger.info(`Service A is running on port ${port}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  await pool.end();
  process.exit(0);
});