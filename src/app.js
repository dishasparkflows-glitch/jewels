const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('./config/db');
const { NODE_ENV, URL } = require('./config/constants');
const routes = require('./routes');
const { errorHandler } = require('./middleware/error.middleware');
const { requestContextMiddleware } = require('./utils/context');

const app = express();

app.use(requestContextMiddleware);

// ─── Security & Parsing ────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: false,
}));

const allowedOrigins = [
  URL.ADMIN_URL,
  URL.FRONTEND_URL,
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175'
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || NODE_ENV === 'development') {
      return callback(null, true);
    }
    return callback(new Error(`CORS blocked: Origin ${origin} is not allowed`));
  },
  credentials: true,
  methods: '*',
  allowedHeaders: '*',
}));
app.use(express.json({ limit: '10mb', verify: (req, res, buf) => { req.rawBody = buf; } }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Logging ───────────────────────────────────────────────────
if (NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// ─── API Routes ────────────────────────────────────────────────
app.use('/api', routes);

// ─── Health Check ──────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Jewels API is running',
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
  });
});

// ─── 404 Handler ───────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
  });
});

// ─── Global Error Handler ──────────────────────────────────────
app.use(errorHandler);

module.exports = app;
