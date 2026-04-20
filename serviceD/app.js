const express = require('express');
const winston = require('winston');
const axios = require('axios');
const { Pool } = require('pg');
require('dotenv').config();
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3004;

app.use(cors());

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/serviceD.log' })
  ],
});

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASS,
  port: process.env.DB_PORT,
});

// Fix: Use service name instead of localhost
const SERVICE_E_URL = process.env.SERVICE_E_URL || 'http://servicee:3004/serviceE';

app.use((req, res, next) => {
  logger.info(`Request received on ${req.originalUrl}`);
  next();
});

app.get('/serviceD', async (req, res) => {
  const requestId = req.headers['x-request-id'] || `req-${Date.now()}`;
  
  try {
    logger.info({ requestId, message: "Calling Service E", url: SERVICE_E_URL });
    
    const response = await axios.get(SERVICE_E_URL, {
      timeout: 5000,
      headers: { 'X-Request-ID': requestId }
    });
    
    res.send(response.data);
  } catch (err) {
    logger.error({ 
      requestId,
      message: 'Error in Service D',
      error: err.message 
    });
    
    res.status(500).json({ 
      error: 'Error in Service D',
      requestId 
    });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'Service D' });
});

app.listen(port, () => {
  logger.info(`Service D running on port ${port}`);
});