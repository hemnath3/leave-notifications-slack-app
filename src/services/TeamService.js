const Team = require('../models/Team');
const Leave = require('../models/Leave');

class TeamService {
  // Create a new team for a channel
  static async createTeam(channelId, channelName, teamName) {
    try {
      const existingTeam = await Team.getTeamByChannel(channelId);
      if (existingTeam) {
        return existingTeam;
      }

      const team = new Team({
        channelId,
        channelName,
        teamName: teamName || channelName
      });

      return await team.save();
    } catch (error) {
      console.error('Error creating team:', error);
      throw error;
    }
  }

  // Add a member to a team
  static async addMemberToTeam(channelId, memberData) {
    try {
      let team = await Team.getTeamByChannel(channelId);
      
      if (!team) {
        // Create team if it doesn't exist
        team = await this.createTeam(channelId, memberData.channelName || 'Unknown Channel', 'Team');
      }

      return await Team.addMember(channelId, memberData);
    } catch (error) {
      console.error('Error adding member to team:', error);
      throw error;
    }
  }

  // Remove a member from a team
  static async removeMemberFromTeam(channelId, userId) {
    try {
      return await Team.removeMember(channelId, userId);
    } catch (error) {
      console.error('Error removing member from team:', error);
      throw error;
    }
  }

  // Get team by channel ID
  static async getTeamByChannel(channelId) {
    try {
      return await Team.getTeamByChannel(channelId);
    } catch (error) {
      console.error('Error getting team by channel:', error);
      throw error;
    }
  }

  // Get all active teams
  static async getAllActiveTeams() {
    try {
      return await Team.getAllActiveTeams();
    } catch (error) {
      console.error('Error getting all active teams:', error);
      throw error;
    }
  }

  // Get user's team (the team they belong to)
  static async getUserTeam(userId) {
    try {
      const team = await Team.findOne({
        'members.userId': userId,
        isActive: true
      });
      return team;
    } catch (error) {
      console.error('Error getting user team:', error);
      throw error;
    }
  }

  // Get all teams a user belongs to
  static async getUserTeams(userId) {
    try {
      const teams = await Team.find({
        'members.userId': userId,
        isActive: true
      });
      return teams;
    } catch (error) {
      console.error('Error getting user teams:', error);
      throw error;
    }
  }

  // Get all channels where user is a member and app is installed
  static async getUserChannelsWithApp(userId, slackClient) {
    try {
      console.log(`🔍 Getting channels for user ${userId} where app is installed and bot has access`);
      
      // Step 1: Get all channels user is a member of (public + private)
      let userChannels = [];
      try {
        const userConversations = await slackClient.users.conversations({
          user: userId,
          types: 'public_channel,private_channel',
          exclude_archived: true,
          limit: 1000
        });
        userChannels = userConversations.channels || [];
        console.log(`🔍 User is in ${userChannels.length} total channels`);
      } catch (userError) {
        console.log(`⚠️ Could not get user conversations:`, userError.message);
        return [];
      }
      
      // Step 2: Get all channels where app is installed (be more restrictive)
      let appChannels = [];
      try {
        const conversationsList = await slackClient.conversations.list({
          types: 'public_channel,private_channel',
          exclude_archived: true,
          limit: 1000
        });
        
        // Use all channels from conversations.list - they should be valid
        appChannels = conversationsList.channels || [];
        console.log(`🔍 App has access to ${appChannels.length} channels`);
      } catch (botError) {
        console.log(`⚠️ Could not get conversations list:`, botError.message);
        return [];
      }
      
      // Step 3: Intersect user channels with app channels (already filtered for bot access)
      const availableChannels = [];
      const appChannelIds = new Set(appChannels.map(c => c.id));
      
      for (const userChannel of userChannels) {
        // Check if this channel is in both user's channels AND app's channels
        if (appChannelIds.has(userChannel.id)) {
          // Skip archived or closed channels
          if (userChannel.is_archived || userChannel.is_member === false) {
            console.log(`⚠️ Skipping archived/closed channel: #${userChannel.name} (${userChannel.id})`);
            continue;
          }
          
          console.log(`✅ Found valid channel: #${userChannel.name} (${userChannel.id}) - Private: ${userChannel.is_private}`);
          
          availableChannels.push({
            channelId: userChannel.id,
            channelName: userChannel.name,
            isPrivate: userChannel.is_private || false
          });
        } else {
          console.log(`⚠️ Channel #${userChannel.name} (${userChannel.id}) not in app's channel list`);
        }
      }
      
      console.log(`✅ Final result: ${availableChannels.length} available channels for user ${userId}:`, 
        availableChannels.map(c => `#${c.channelName}${c.isPrivate ? ' (private)' : ''}`));
      
      return availableChannels;
    } catch (error) {
      console.error('Error getting user channels with app:', error);
      return [];
    }
  }

  // Get user's channel preferences (last selected channels)
  static async getUserChannelPreferences(userId) {
    try {
      // For now, we'll store this in a simple way
      // In the future, we could create a UserPreferences model
      const user = await this.getUserTeam(userId);
      if (user && user.preferences) {
        return user.preferences.lastSelectedChannels || [];
      }
      return [];
    } catch (error) {
      console.error('Error getting user channel preferences:', error);
      return [];
    }
  }

  // Save user's channel preferences
  static async saveUserChannelPreferences(userId, selectedChannels) {
    try {
      // For now, we'll store this in a simple way
      // In the future, we could create a UserPreferences model
      console.log(`💾 Saving channel preferences for user ${userId}:`, selectedChannels);
      // This is a placeholder - we'll implement proper storage later
      return true;
    } catch (error) {
      console.error('Error saving user channel preferences:', error);
      return false;
    }
  }

  // Check if user is member of a specific team
  static async isUserMemberOfTeam(userId, channelId) {
    try {
      const team = await Team.getTeamByChannel(channelId);
      if (!team) {
        return false;
      }
      return team.isMember(userId);
    } catch (error) {
      console.error('Error checking if user is member of team:', error);
      return false;
    }
  }

  // Get team members
  static async getTeamMembers(channelId) {
    try {
      const team = await Team.getTeamByChannel(channelId);
      if (!team) {
        return [];
      }
      return team.members;
    } catch (error) {
      console.error('Error getting team members:', error);
      return [];
    }
  }

  // Get leaves for a specific team
  static async getTeamLeaves(channelId, startDate, endDate) {
    try {
      const team = await Team.getTeamByChannel(channelId);
      if (!team) {
        return [];
      }

      const teamMemberIds = team.members.map(m => m.userId);
      
      return await Leave.find({
        channelId: channelId,
        userId: { $in: teamMemberIds },
        startDate: { $lte: endDate },
        endDate: { $gte: startDate }
      }).sort({ startDate: 1 });
    } catch (error) {
      console.error('Error getting team leaves:', error);
      return [];
    }
  }

  // Auto-add user to team when they submit a leave request
  static async autoAddUserToTeam(channelId, channelName, userData) {
    try {
      await this.addMemberToTeam(channelId, {
        userId: userData.userId,
        userName: userData.userName,
        userEmail: userData.userEmail || null,
        role: 'member'
      });
    } catch (error) {
      console.error('Error auto-adding user to team:', error);
      // Don't throw error, just log it
    }
  }
}

module.exports = TeamService; 