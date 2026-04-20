const express = require('express');
const winston = require('winston');
const { Pool } = require('pg');
require('dotenv').config();
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3005;

app.use(cors());

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/serviceE.log' })
  ],
});

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASS,
  port: process.env.DB_PORT,
});

app.use((req, res, next) => {
  logger.info(`Request received on ${req.originalUrl}`);
  next();
});

app.get('/serviceE', (req, res) => {
  const requestId = req.headers['x-request-id'] || `req-${Date.now()}`;
  logger.info({ requestId, message: 'Final service response' });
  res.send('Service E completed the chain.');
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'Service E' });
});

app.listen(port, () => {
  logger.info(`Service E running on port ${port}`);
});