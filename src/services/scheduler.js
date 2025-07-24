const cron = require('node-cron');
const moment = require('moment-timezone');
const Leave = require('../models/Leave');
const Team = require('../models/Team');
const DateUtils = require('../utils/dateUtils');

class NotificationScheduler {
  constructor(slackApp) {
    this.slackApp = slackApp;
    this.isRunning = false;
  }

  start() {
    if (this.isRunning) {
      console.log('Scheduler is already running');
      return;
    }

    // Schedule daily morning notification at 1:21 PM AEST (for debugging)
    cron.schedule('21 13 * * *', async () => {
      console.log('Running daily leave notification...');
      await this.sendDailyNotifications();
    }, {
      timezone: 'Australia/Sydney'
    });



    this.isRunning = true;
    console.log('Notification scheduler started');
  }

  async sendDailyNotifications() {
    try {
      // Get all active teams (channels with the app installed)
      const teams = await Team.getAllActiveTeams();
      
      for (const team of teams) {
        await this.sendDailyNotificationForChannel(team.channelId);
      }
    } catch (error) {
      console.error('Error sending daily notifications:', error);
    }
  }

  async sendDailyNotificationForChannel(channelId) {
    try {
      // Use the same date creation logic as send-reminder
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      // Get team info
      const team = await Team.getTeamByChannel(channelId);
      if (!team) {
        console.log(`No team found for channel ${channelId}, skipping notification`);
        return;
      }
      
      // Get team member user IDs
      const teamMemberIds = team.members.map(m => m.userId);
      
      console.log(`🔍 Scheduler: Team ${team.teamName} (${channelId}) has ${team.members.length} members:`, team.members.map(m => m.userName));
      console.log(`🔍 Scheduler: Team member IDs:`, teamMemberIds);
      
      // Get leaves that overlap with today (including leaves that start tomorrow but are ongoing)
      console.log(`🔍 Scheduler: Searching for leaves with criteria:`, {
        notifiedChannelId: channelId,
        teamMemberIds: teamMemberIds,
        dateRange: `${today.toISOString().split('T')[0]} to ${tomorrow.toISOString().split('T')[0]}`
      });
      
      // Use the same logic as the working send-reminder command
      const leaves = await Leave.find({
        $or: [
          { channelId: channelId }, // Leaves stored in this channel
          { 'notifiedChannels.channelId': channelId } // Leaves notified to this channel
        ],
        startDate: { $lte: tomorrow }, // Include leaves that start today or tomorrow
        endDate: { $gte: today }       // Include leaves that end today or later
      }).sort({ startDate: 1 });
      
      console.log(`🔍 Scheduler: Found ${leaves.length} leaves for channel ${channelId} on ${today.toISOString().split('T')[0]}`);
      console.log(`🔍 Scheduler: Today: ${today.toISOString()}, Tomorrow: ${tomorrow.toISOString()}`);
      
      // Debug: Check all leaves notified to this channel (without team member filter)
      const allLeavesNotifiedToChannel = await Leave.find({
        'notifiedChannels.channelId': channelId,
        startDate: { $lte: tomorrow },
        endDate: { $gte: today }
      });
      
      // Debug: Check all leaves for this channel without any date filters
      const allLeavesForChannel = await Leave.find({
        $or: [
          { channelId: channelId },
          { 'notifiedChannels.channelId': channelId }
        ]
      });
      console.log(`🔍 Scheduler: All leaves for channel ${channelId} (no date filter): ${allLeavesForChannel.length}`);
      allLeavesForChannel.forEach(leave => {
        console.log(`🔍 Scheduler: All leave for channel - ${leave.userName} (${leave.startDate} to ${leave.endDate}) - Source: ${leave.channelName}`);
      });
      console.log(`🔍 Scheduler: All leaves notified to channel ${channelId} (without team filter): ${allLeavesNotifiedToChannel.length}`);
      allLeavesNotifiedToChannel.forEach(leave => {
        console.log(`🔍 Scheduler: Leave notified to channel - ${leave.userName} (${leave.userId}) - ${leave.startDate} to ${leave.endDate}`);
        console.log(`🔍 Scheduler: Leave notifiedChannels:`, leave.notifiedChannels);
      });
      
      // Debug: Check ALL leaves in database for this channel (without any filters)
      const allLeavesInDB = await Leave.find({});
      console.log(`🔍 Scheduler: ALL leaves in database: ${allLeavesInDB.length}`);
      allLeavesInDB.forEach(leave => {
        console.log(`🔍 Scheduler: DB Leave - ${leave.userName} (${leave.userId}) - ${leave.startDate} to ${leave.endDate} - Source: ${leave.channelName} - Notified:`, leave.notifiedChannels);
      });
      
      if (leaves.length === 0) {
        // Check if there are any leaves for this channel at all (for debugging)
        const allLeavesForChannel = await Leave.find({ channelId: channelId });
        console.log(`🔍 Scheduler: Total leaves in database for channel ${channelId}: ${allLeavesForChannel.length}`);
        allLeavesForChannel.forEach(leave => {
          console.log(`🔍 Scheduler: All leave in DB - ${leave.userName} (${leave.startDate} to ${leave.endDate})`);
        });
      } else {
        leaves.forEach(leave => {
          console.log(`🔍 Scheduler: Leave - ${leave.userName} (${leave.startDate} to ${leave.endDate})`);
        });
      }
      
      // Remove early return to allow upcoming section to be added even when no current leaves

      // Show only leaves that start today (not leaves that start tomorrow but overlap with today)
      const currentLeaves = leaves.filter(leave => {
        const startDate = new Date(leave.startDate);
        const startDateStr = startDate.toISOString().split('T')[0];
        return startDateStr === today.toISOString().split('T')[0]; // Only leaves that start exactly today
      });
      
      console.log(`🔍 Scheduler: Today's key: ${today.toISOString().split('T')[0]}`);
      console.log(`🔍 Scheduler: Today's leaves: ${currentLeaves.length}`);
      console.log(`🔍 Scheduler: Current leaves: ${currentLeaves.length}`);
      
      // Create the base message structure
      const blocks = [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '🌅 Good Morning! Today\'s Team Availability',
            emoji: true
          }
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `📅 *Daily Team Availability Update* | ⏰ *${DateUtils.getCurrentTimeString()} AEST*`
            }
          ]
        },
        {
          type: 'divider'
        }
      ];
      
      if (currentLeaves.length === 0) {
        // Add "no leaves" message to the blocks instead of sending separate message
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '✅ *No team members are away today! Everyone is available.* 🎉'
          }
        });
            } else {
      
      currentLeaves.forEach(leave => {
        const startDate = new Date(leave.startDate);
        const endDate = new Date(leave.endDate);
        const isMultiDay = startDate.toDateString() !== endDate.toDateString();
        
        let emoji, text;
        
        if (isMultiDay) {
          // Multi-day leave - show vacation message
          const startStr = startDate.toLocaleDateString();
          const endStr = endDate.toLocaleDateString();
          emoji = '🏖️';
          text = `*${leave.userName}* - Vacationing (${startStr} - ${endStr})`;
        } else {
          // Single day leave
          if (leave.isFullDay) {
            switch(leave.leaveType) {
              case 'vacation':
                emoji = '🏖️';
                text = `*${leave.userName}* - Vacationing`;
                break;
              case 'wellness':
                emoji = '🧘';
                text = `*${leave.userName}* - On Wellness Day`;
                break;
              case 'sick':
                emoji = '🤒';
                text = `*${leave.userName}* - On Sick Leave`;
                break;
              case 'personal':
                emoji = '👤';
                text = `*${leave.userName}* - On Personal Leave`;
                break;
              default:
                emoji = '📝';
                text = `*${leave.userName}* - On Other Leave`;
            }
          } else {
            emoji = '⏰';
            text = `*${leave.userName}* - Away between ${leave.startTime} to ${leave.endTime}\n> _${leave.reason}_`;
          }
        }
        
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `${emoji} ${text}`
          }
        });
      });
      
      // Count only full-day leaves for summary
      const fullDayLeaves = currentLeaves.filter(leave => {
        const startDate = new Date(leave.startDate);
        const endDate = new Date(leave.endDate);
        const isMultiDay = startDate.toDateString() !== endDate.toDateString();
        return isMultiDay || leave.isFullDay;
      });
      
      // Get unique members (in case someone has multiple leaves for the same date)
      const uniqueMembers = [...new Set(fullDayLeaves.map(leave => leave.userId))];
      
      // Add summary footer only if there are leaves today
      if (uniqueMembers.length > 0) {
        blocks.push({
          type: 'divider'
        });
        blocks.push({
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `📊 *${uniqueMembers.length} team member${uniqueMembers.length === 1 ? '' : 's'} away today*`
            }
          ]
        });
      }
      
      // Always call upcoming section and let it handle the logic
      console.log('🔄 About to add upcoming leaves section...');
      console.log('🔄 Current leaves count:', currentLeaves.length);
      console.log('🔄 Blocks before upcoming section:', blocks.length);
      const hasUpcomingLeaves = await this.addUpcomingLeavesSection(blocks, channelId, currentLeaves.length);
      console.log('🔄 Has upcoming leaves result:', hasUpcomingLeaves);
      if (hasUpcomingLeaves) {
        console.log('✅ Upcoming leaves section added');
      } else {
        console.log('ℹ️ No upcoming leaves found, skipping section');
      }
      console.log('🔄 Blocks after upcoming section:', blocks.length);
      
      try {
        console.log('📤 Sending message to channel:', channelId);
        console.log('📤 Message blocks count:', blocks.length);
        await this.slackApp.client.chat.postMessage({
          channel: channelId,
          blocks: blocks
        });
        console.log('✅ Message sent successfully to channel:', channelId);
      } catch (error) {
        if (error.code === 'slack_webapi_platform_error' && error.data.error === 'not_in_channel') {
          console.log(`⚠️ App is not a member of channel ${channelId}. Skipping daily notification.`);
        } else {
          console.error(`Error sending daily notification for channel ${channelId}:`, error);
        }
      }
    }
    } catch (error) {
      console.error(`Error processing daily notification for channel ${channelId}:`, error);
    }
  }



  getLeaveTypeEmoji(type) {
    const emojis = {
      vacation: '🏖️',
      wellness: '🧘',
      sick: '🤒',
      personal: '👤',
      other: '📝'
    };
    return emojis[type] || '📝';
  }

  async addUpcomingLeavesSection(blocks, channelId, currentLeavesCount = 0) {
    try {
      console.log('🔍 Adding upcoming leaves section for channel:', channelId);
      // Use the same date logic as the main function
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      console.log('📅 Today is:', today.toISOString().split('T')[0]);
      const nextThreeDays = [];
      
      // Get next 3 working days
      for (let i = 1; i <= 7; i++) { // Check up to 7 days ahead
        const checkDate = new Date(today);
        checkDate.setDate(checkDate.getDate() + i);
        if (DateUtils.isWorkingDay(moment(checkDate).tz('Australia/Sydney'))) {
          nextThreeDays.push(checkDate);
          if (nextThreeDays.length >= 3) break;
        }
      }
      
      console.log('📅 Next 3 working days:', nextThreeDays.map(d => d.toISOString().split('T')[0]));
      
      if (nextThreeDays.length === 0) {
        console.log('⚠️ No working days found in next 7 days');
        return;
      }
      
      // Get leaves for the next 3 working days
      const upcomingLeaves = [];
      for (const date of nextThreeDays) {
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);
        
        console.log(`🔍 Checking leaves for ${date.toISOString().split('T')[0]} (${startOfDay} to ${endOfDay})`);
        
        const leaves = await Leave.find({
          $or: [
            { channelId: channelId }, // Leaves stored in this channel
            { 'notifiedChannels.channelId': channelId } // Leaves notified to this channel
          ],
          startDate: { $lte: endOfDay },
          endDate: { $gte: startOfDay }
        }).lean();
        
        // Filter out leaves that are already shown in today's section
        const filteredLeaves = leaves.filter(leave => {
          const leaveStart = new Date(leave.startDate);
          const leaveEnd = new Date(leave.endDate);
          const todayStart = new Date(today);
          const todayEnd = new Date(today);
          todayEnd.setHours(23, 59, 59, 999);
          
          // Only include leaves that don't overlap with today
          const overlapsWithToday = (leaveStart <= todayEnd && leaveEnd >= todayStart);
          console.log(`🔍 Leave ${leave.userName} (${leaveStart.toISOString().split('T')[0]} to ${leaveEnd.toISOString().split('T')[0]}) overlaps with today: ${overlapsWithToday}`);
          return !overlapsWithToday;
        });
        
        console.log(`📋 Found ${leaves.length} total leaves, ${filteredLeaves.length} future leaves for ${date.toISOString().split('T')[0]}`);
        
        // Always add the date, even if no leaves (to show "No leaves" message)
        upcomingLeaves.push({
          date: date,
          leaves: filteredLeaves
        });
      }
      
      console.log(`📊 Total upcoming leave days found: ${upcomingLeaves.length}`);
      
      // Check if any of the upcoming days have leaves
      const hasAnyUpcomingLeaves = upcomingLeaves.some(dayData => dayData.leaves.length > 0);
      
      // Implement the logic:
      // 1. If there IS a leave for today AND NO leaves in upcoming days → Omit upcoming section
      // 2. If there is NO leave today BUT there ARE leaves in upcoming days → Show upcoming section
      // 3. If there is NO leave today AND NO leaves in upcoming days → Don't show upcoming section
      
      if (currentLeavesCount > 0 && !hasAnyUpcomingLeaves) {
        // Case 1: Has leaves today but no upcoming → Omit upcoming section
        console.log('ℹ️ Has leaves today but no upcoming → Omit upcoming section');
        return false;
      } else if (currentLeavesCount === 0 && hasAnyUpcomingLeaves) {
        // Case 2: No leaves today but has upcoming → Show upcoming section
        console.log('✅ No leaves today but has upcoming → Show upcoming section');
      } else if (currentLeavesCount === 0 && !hasAnyUpcomingLeaves) {
        // Case 3: No leaves today and no upcoming → Don't show upcoming section
        console.log('ℹ️ No leaves today and no upcoming → Don\'t show upcoming section');
        return false;
      } else {
        // Case 4: Has leaves today and has upcoming → Show upcoming section
        console.log('✅ Has leaves today and has upcoming → Show upcoming section');
      }
      
      if (hasAnyUpcomingLeaves) {
        console.log('✅ Adding upcoming leaves section to blocks');
        blocks.push({
          type: 'divider'
        });
        
        blocks.push({
          type: 'header',
          text: {
            type: 'plain_text',
            text: '📅 Upcoming Leaves',
            emoji: true
          }
        });
        
        for (const dayData of upcomingLeaves) {
          const dateMoment = moment(dayData.date).tz('Australia/Sydney');
          const dateStr = dateMoment.format('Do MMM');
          const dayName = dateMoment.format('dddd');
          
          // Check if it's tomorrow
          const tomorrow = DateUtils.getCurrentDate().add(1, 'day').startOf('day');
          const isTomorrow = dateMoment.isSame(tomorrow, 'day');
          
          const dateHeader = isTomorrow ? 'Tomorrow' : `${dayName}, ${dateStr}`;
          
          blocks.push({
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*${dateHeader}:*`
            }
          });
          
          if (dayData.leaves.length === 0) {
            // Show "No leaves" message for this day
            blocks.push({
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: '   • No leaves scheduled'
              }
            });
          } else {
            for (const leave of dayData.leaves) {
              const emoji = this.getLeaveTypeEmoji(leave.leaveType);
              let text = `• ${emoji} *${leave.userName}* - `;
              
              if (leave.isFullDay) {
                text += `${leave.leaveType.charAt(0).toUpperCase() + leave.leaveType.slice(1)}`;
              } else {
                text += `Away ${leave.startTime} - ${leave.endTime}`;
              }
              
              if (leave.reason && leave.leaveType === 'other') {
                text += ` (${leave.reason})`;
              }
              
              blocks.push({
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: text
                }
              });
            }
          }
        }
      }
      
      return hasAnyUpcomingLeaves;
    } catch (error) {
      console.error('Error adding upcoming leaves section:', error);
      return false;
    }
  }

  stop() {
    this.isRunning = false;
    console.log('Notification scheduler stopped');
  }
}

module.exports = NotificationScheduler; 