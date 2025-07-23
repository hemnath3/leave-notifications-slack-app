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
      // Get all channels where the app is installed (active teams)
      const allTeams = await this.getAllActiveTeams();
      
      // Filter to only channels where user is a member
      const userChannels = allTeams.filter(team => 
        team.members.some(member => member.userId === userId)
      );
      
      console.log(`Found ${userChannels.length} channels where user ${userId} is a member`);
      
      // Get channel information for each channel
      const verifiedChannels = [];
      
      for (const team of userChannels) {
        try {
          // Try to get channel info from Slack API
          const channelInfo = await slackClient.conversations.info({
            channel: team.channelId
          });
          
          verifiedChannels.push({
            channelId: team.channelId,
            channelName: channelInfo.channel.name,
            isPrivate: channelInfo.channel.is_private || false
          });
        } catch (channelError) {
          console.log(`⚠️ Could not get info for channel ${team.channelId}:`, channelError.message);
          
          // For private channels or inaccessible channels, use stored name
          verifiedChannels.push({
            channelId: team.channelId,
            channelName: team.channelName || 'Private Channel',
            isPrivate: true
          });
        }
      }
      
      console.log(`Processed ${verifiedChannels.length} channels for user ${userId}:`, 
        verifiedChannels.map(c => `#${c.channelName}${c.isPrivate ? ' (private)' : ''}`));
      
      return verifiedChannels;
    } catch (error) {
      console.error('Error getting user channels with app:', error);
      return [];
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