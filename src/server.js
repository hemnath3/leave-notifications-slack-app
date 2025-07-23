// Disable SSL certificate warnings for development only
if (process.env.NODE_ENV !== 'production') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

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

// Determine if we should use Socket Mode or HTTP webhooks
const useSocketMode = process.env.USE_SOCKET_MODE === 'true' || process.env.NODE_ENV !== 'production';

let slackApp;

if (useSocketMode) {
  // Socket Mode for development
  slackApp = new App({
    token: process.env.SLACK_BOT_TOKEN,
    signingSecret: process.env.SLACK_SIGNING_SECRET,
    socketMode: true,
    appToken: process.env.SLACK_APP_TOKEN,
    logLevel: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  });
  console.log('🔧 Using Socket Mode (development)');
} else {
  // HTTP webhooks for production
  slackApp = new App({
    token: process.env.SLACK_BOT_TOKEN,
    signingSecret: process.env.SLACK_SIGNING_SECRET,
    logLevel: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  });
  console.log('🚀 Using HTTP webhooks (production)');
}



// Import Slack event handlers
require('./slack/events')(slackApp);
require('./slack/actions')(slackApp);
require('./slack/commands')(slackApp);

// API Routes
expressApp.use('/api/leaves', leaveRoutes);

// Slack webhook endpoint (for production HTTP mode)
if (!useSocketMode) {
  // For HTTP webhooks, we need to create the receiver manually
  const { createExpressReceiver } = require('@slack/bolt');
  const receiver = createExpressReceiver({
    signingSecret: process.env.SLACK_SIGNING_SECRET,
    endpoints: {
      events: '/slack/events'
    }
  });
  
  // Attach the receiver to the Slack app
  slackApp.receiver = receiver;
  
  // Mount the receiver routes
  expressApp.use('/slack/events', receiver.router);
  console.log('📡 Slack webhook endpoint available at /slack/events');
}

// Health check endpoint
expressApp.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    mode: useSocketMode ? 'socket' : 'webhook',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB');
    
    // Start Express server
    expressApp.listen(PORT, () => {
      console.log(`🌐 Express server running on port ${PORT}`);
    });
    
    // Start Slack app
    (async () => {
      if (useSocketMode) {
        await slackApp.start();
        console.log('⚡️ Slack app is running in Socket Mode!');
      } else {
        console.log('⚡️ Slack app is ready for HTTP webhooks!');
      }
      
      // Start notification scheduler
      const scheduler = new NotificationScheduler(slackApp);
      scheduler.start();
      console.log('⏰ Notification scheduler started');
    })();
  })
  .catch((error) => {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  });

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  if (useSocketMode) {
    await slackApp.stop();
  }
  process.exit(0);
});

module.exports = { expressApp, slackApp }; 