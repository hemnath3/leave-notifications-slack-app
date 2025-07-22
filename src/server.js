// Disable SSL certificate warnings for development
// This prevents "self-signed certificate in certificate chain" warnings
// from the Slack Web API client
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const { App } = require('@slack/bolt');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Import routes and models
const leaveRoutes = require('./routes/leave');
const Leave = require('./models/Leave');
const NotificationScheduler = require('./services/scheduler');

// Initialize Express app
const expressApp = express();
const PORT = process.env.PORT || 3000;

// Security middleware
expressApp.use(helmet());
expressApp.use(cors());
expressApp.use(express.json());

// Serve static files
expressApp.use(express.static('public'));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
expressApp.use(limiter);

// Initialize Slack app
const slackApp = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN,
  logLevel: 'debug',
});

// Import Slack event handlers
require('./slack/events')(slackApp);
require('./slack/actions')(slackApp);
require('./slack/commands')(slackApp);

// API Routes
expressApp.use('/api/leaves', leaveRoutes);

// Slack webhook endpoint (commented out for Socket Mode)
// expressApp.use('/slack/events', slackApp.receiver.router);

// Health check endpoint
expressApp.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    
    // Start Express server
    expressApp.listen(PORT, () => {
      console.log(`Express server running on port ${PORT}`);
    });
    
    // Start Slack app
    (async () => {
      await slackApp.start();
      console.log('⚡️ Slack app is running!');
      
      // Start notification scheduler
      const scheduler = new NotificationScheduler(slackApp);
      scheduler.start();
    })();
  })
  .catch((error) => {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  });

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await slackApp.stop();
  process.exit(0);
});

module.exports = { expressApp, slackApp }; 