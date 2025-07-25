const mongoose = require('mongoose');

const teamSchema = new mongoose.Schema({
  channelId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  channelName: {
    type: String,
    required: true
  },
  teamName: {
    type: String,
    required: true
  },
  members: [{
    userId: {
      type: String,
      required: true
    },
    userName: {
      type: String,
      required: true
    },
    userEmail: {
      type: String,
      default: null
    },
    role: {
      type: String,
      enum: ['member', 'admin'],
      default: 'member'
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  schedulerEnabled: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt field before saving
teamSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Index for efficient queries
teamSchema.index({ channelId: 1, isActive: 1 });
teamSchema.index({ 'members.userId': 1 });

// Static method to get team by channel ID
teamSchema.statics.getTeamByChannel = function(channelId) {
  return this.findOne({ channelId, isActive: true });
};

// Static method to get all active teams
teamSchema.statics.getAllActiveTeams = function() {
  return this.find({ isActive: true });
};

// Static method to add member to team
teamSchema.statics.addMember = async function(channelId, memberData) {
  const team = await this.findOne({ channelId, isActive: true });
  if (!team) {
    throw new Error('Team not found');
  }
  
  // Check if member already exists
  const existingMember = team.members.find(m => m.userId === memberData.userId);
  if (existingMember) {
    return team;
  }
  
  team.members.push(memberData);
  return team.save();
};

// Static method to remove member from team
teamSchema.statics.removeMember = async function(channelId, userId) {
  const team = await this.findOne({ channelId, isActive: true });
  if (!team) {
    throw new Error('Team not found');
  }
  
  team.members = team.members.filter(m => m.userId !== userId);
  return team.save();
};

// Instance method to check if user is member
teamSchema.methods.isMember = function(userId) {
  return this.members.some(m => m.userId === userId);
};

// Instance method to get member data
teamSchema.methods.getMember = function(userId) {
  return this.members.find(m => m.userId === userId);
};

module.exports = mongoose.model('Team', teamSchema); 