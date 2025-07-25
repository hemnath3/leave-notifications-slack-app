const mongoose = require('mongoose');

const leaveSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  userName: {
    type: String,
    required: true
  },
  userEmail: {
    type: String,
    required: false,
    default: 'not-provided@example.com'
  },
  leaveType: {
    type: String,
    enum: ['vacation', 'wellness', 'sick', 'personal', 'other'],
    required: true
  },
  startDate: {
    type: Date,
    required: true,
    index: true
  },
  endDate: {
    type: Date,
    required: true,
    index: true
  },
  startTime: {
    type: String,
    default: '09:00'
  },
  endTime: {
    type: String,
    default: '17:00'
  },
  isFullDay: {
    type: Boolean,
    default: true
  },
  reason: {
    type: String,
    required: false,
    maxlength: 500,
    default: ''
  },
  channelId: {
    type: String,
    required: true,
    index: true
  },
  channelName: {
    type: String,
    required: true
  },
  notifiedChannels: [{
    channelId: String,
    channelName: String
  }],
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  approvedBy: {
    type: String,
    default: null
  },
  approvedAt: {
    type: Date,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt field before saving
leaveSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Index for efficient queries
leaveSchema.index({ startDate: 1, endDate: 1, channelId: 1 });
leaveSchema.index({ userId: 1, startDate: 1 });

// Unique compound index to prevent duplicate leaves for same user, date range, channel, and leave type
leaveSchema.index({ userId: 1, startDate: 1, endDate: 1, channelId: 1, leaveType: 1 }, { unique: true });

// Static method to get leaves for a specific date range
leaveSchema.statics.getLeavesForDateRange = function(startDate, endDate, channelId) {
  return this.find({
    startDate: { $lte: endDate },
    endDate: { $gte: startDate },
    channelId: channelId,
    status: { $in: ['pending', 'approved'] }
  }).sort({ startDate: 1 });
};

// Static method to get today's leaves
leaveSchema.statics.getTodaysLeaves = function(channelId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  return this.find({
    startDate: { $lt: tomorrow },
    endDate: { $gte: today },
    channelId: channelId,
    status: { $in: ['pending', 'approved'] }
  }).sort({ startDate: 1 });
};

// Instance method to check if leave overlaps with existing leaves
leaveSchema.methods.hasOverlap = async function() {
  const overlap = await this.constructor.findOne({
    userId: this.userId,
    startDate: { $lte: this.endDate },
    endDate: { $gte: this.startDate },
    _id: { $ne: this._id },
    status: { $in: ['pending', 'approved'] }
  });
  
  return !!overlap;
};

module.exports = mongoose.model('Leave', leaveSchema); 