const express = require('express');
const cors = require('cors');
const winston = require('winston');
const axios = require('axios');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3002 ;

app.use(cors());

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/serviceB.log' })
  ],
});

app.use((req, res, next) => {
  logger.info(`Request received on ${req.originalUrl}`);
  next();
});

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASS,
  port: process.env.DB_PORT,
});

// Validate environment variables
const requiredEnvVars = ['DB_USER', 'DB_HOST', 'DB_NAME', 'DB_PASS', 'DB_PORT', 'SERVICE_C_URL'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
  logger.error(`Missing required environment variables: ${missingVars.join(', ')}`);
  process.exit(1);
}

app.get('/serviceB', async (req, res) => {
  const requestId = req.headers['x-request-id'] || `req-${Date.now()}`;
  
  try {
    logger.info({ requestId, message: "Service B processing request, calling Service C", url: process.env.SERVICE_C_URL });
    
    const response = await axios.get(process.env.SERVICE_C_URL, {
      timeout: 5000,
      headers: { 'X-Request-ID': requestId }
    });
    
    logger.info({ requestId, message: "Response from Service C received", data: response.data });
    
    const result = await pool.query('SELECT NOW()');
    logger.info({ requestId, message: 'Database query successful' });
    
    res.send(response.data);
  } catch (err) {
    logger.error({ 
      requestId,
      message: 'Error in Service B',
      error: err.message,
      serviceCalled: process.env.SERVICE_C_URL,
      responseStatus: err.response?.status
    });

    if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
      return res.status(503).json({ 
        error: 'Service C unavailable',
        requestId 
      });
    }

    res.status(500).json({ 
      error: 'Error in Service B',
      requestId 
    });
  }
});

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'healthy', service: 'Service B' });
  } catch (err) {
    res.status(503).json({ status: 'unhealthy', service: 'Service B' });
  }
});

app.listen(port, () => {
  logger.info(`Service B running on port ${port}`);
});