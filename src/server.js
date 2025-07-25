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

// For now, let's use Socket Mode for both development and production
// This is more reliable and doesn't require complex webhook setup
slackApp = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN,
  logLevel: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
});

if (useSocketMode) {
  console.log('🔧 Using Socket Mode (development)');
} else {
  console.log('🔧 Using Socket Mode (production - simplified setup)');
}



// Import Slack event handlers
require('./slack/events')(slackApp);
require('./slack/actions')(slackApp);
require('./slack/commands')(slackApp);

// API Routes
expressApp.use('/api/leaves', leaveRoutes);

// Note: Using Socket Mode for both development and production
// This eliminates the need for complex webhook configuration

// Health check endpoint
expressApp.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    mode: 'socket',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('✅ Connected to MongoDB');
    
    // Fix database indexes on startup
    try {
      const collection = Leave.collection;
      
      // List all indexes
      const indexes = await collection.indexes();
      console.log('🔍 Current indexes:', indexes.map(idx => ({
        name: idx.name,
        key: idx.key,
        unique: idx.unique
      })));
      
      // Find and drop the old unique index (without leaveType)
      const oldIndexName = 'userId_1_startDate_1_endDate_1_channelId_1';
      const hasOldIndex = indexes.some(idx => idx.name === oldIndexName);
      
      if (hasOldIndex) {
        console.log('🗑️ Dropping old unique index:', oldIndexName);
        await collection.dropIndex(oldIndexName);
        console.log('✅ Old index dropped successfully');
      } else {
        console.log('ℹ️ Old index not found, skipping drop');
      }
      
      // Ensure the new index is created
      console.log('🔧 Creating new unique index with leaveType...');
      await Leave.createIndexes();
      console.log('✅ New indexes created successfully');
      
      // Verify the new index
      const newIndexes = await collection.indexes();
      console.log('🔍 Updated indexes:', newIndexes.map(idx => ({
        name: idx.name,
        key: idx.key,
        unique: idx.unique
      })));
    } catch (error) {
      console.error('❌ Index migration failed:', error);
    }
    
    // Start Express server
    expressApp.listen(PORT, () => {
      console.log(`🌐 Express server running on port ${PORT}`);
    });
    
    // Start Slack app
    (async () => {
      await slackApp.start();
      console.log('⚡️ Slack app is running in Socket Mode!');
      
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
  await slackApp.stop();
  process.exit(0);
});

module.exports = { expressApp, slackApp }; 