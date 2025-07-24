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

    // Schedule daily morning notification at 11:30 AM AEST (for debugging)
    cron.schedule('15 12 * * *', async () => {
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
      const today = DateUtils.getCurrentDate().startOf('day');
      const tomorrow = DateUtils.getCurrentDate().add(1, 'day').startOf('day');
      
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
        dateRange: `${today.format('YYYY-MM-DD')} to ${tomorrow.format('YYYY-MM-DD')}`
      });
      
      // Use the same logic as the working send-reminder command
      const leaves = await Leave.find({
        $or: [
          { channelId: channelId }, // Leaves stored in this channel
          { 'notifiedChannels.channelId': channelId } // Leaves notified to this channel
        ],
        startDate: { $lte: tomorrow.toDate() }, // Include leaves that start today or tomorrow
        endDate: { $gte: today.toDate() }       // Include leaves that end today or later
      }).sort({ startDate: 1 });
      
      console.log(`🔍 Scheduler: Found ${leaves.length} leaves for channel ${channelId} on ${today.format('YYYY-MM-DD')}`);
      console.log(`🔍 Scheduler: Today: ${today.format()}, Tomorrow: ${tomorrow.format()}`);
      
      // Debug: Check all leaves notified to this channel (without team member filter)
      const allLeavesNotifiedToChannel = await Leave.find({
        'notifiedChannels.channelId': channelId,
        startDate: { $lte: tomorrow.toDate() },
        endDate: { $gte: today.toDate() }
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
      
      if (leaves.length === 0) {
        // Send a message that no one is on leave today with proper header
        await this.slackApp.client.chat.postMessage({
          channel: channelId,
          blocks: [
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
                  text: `📅 *${DateUtils.getCurrentDate().format('dddd, MMMM Do, YYYY')}* | ⏰ *${DateUtils.getCurrentTimeString()} AEST*`
                }
              ]
            },
            {
              type: 'divider'
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: '✅ *No team members are away today! Everyone is available.* 🎉'
              }
            }
          ]
        });
        return;
      }

      // Show only leaves that start today (not leaves that start tomorrow but overlap with today)
      const currentLeaves = leaves.filter(leave => {
        const startDate = new Date(leave.startDate);
        const startDateStr = startDate.toISOString().split('T')[0];
        return startDateStr === today.format('YYYY-MM-DD'); // Only leaves that start exactly today
      });
      
      console.log(`🔍 Scheduler: Today's key: ${today.format('YYYY-MM-DD')}`);
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
      
      // Add upcoming leaves section only if there are upcoming leaves
      console.log('🔄 About to add upcoming leaves section...');
      const hasUpcomingLeaves = await this.addUpcomingLeavesSection(blocks, channelId);
      if (hasUpcomingLeaves) {
        console.log('✅ Upcoming leaves section added');
      } else {
        console.log('ℹ️ No upcoming leaves found, skipping section');
      }
      
      try {
        await this.slackApp.client.chat.postMessage({
          channel: channelId,
          blocks: blocks
        });
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

  async addUpcomingLeavesSection(blocks, channelId) {
    try {
      console.log('🔍 Adding upcoming leaves section for channel:', channelId);
      const today = DateUtils.getCurrentDate().startOf('day');
      console.log('📅 Today is:', today.format('YYYY-MM-DD'));
      const nextThreeDays = [];
      
      // Get next 3 working days
      for (let i = 1; i <= 7; i++) { // Check up to 7 days ahead
        const checkDate = today.clone().add(i, 'days');
        if (DateUtils.isWorkingDay(checkDate.toDate())) {
          nextThreeDays.push(checkDate);
          if (nextThreeDays.length >= 3) break;
        }
      }
      
      console.log('📅 Next 3 working days:', nextThreeDays.map(d => d.format('YYYY-MM-DD')));
      
      if (nextThreeDays.length === 0) {
        console.log('⚠️ No working days found in next 7 days');
        return;
      }
      
      // Get leaves for the next 3 working days
      const upcomingLeaves = [];
      for (const date of nextThreeDays) {
        const startOfDay = date.startOf('day').toDate();
        const endOfDay = date.endOf('day').toDate();
        
        console.log(`🔍 Checking leaves for ${date.format('YYYY-MM-DD')} (${startOfDay} to ${endOfDay})`);
        
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
          const todayStart = today.toDate();
          const todayEnd = today.endOf('day').toDate();
          
          // Only include leaves that don't overlap with today
          return !(leaveStart <= todayEnd && leaveEnd >= todayStart);
        });
        
        console.log(`📋 Found ${leaves.length} total leaves, ${filteredLeaves.length} future leaves for ${date.format('YYYY-MM-DD')}`);
        
        // Always add the date, even if no leaves (to show "No leaves" message)
        upcomingLeaves.push({
          date: date,
          leaves: filteredLeaves
        });
      }
      
      console.log(`📊 Total upcoming leave days found: ${upcomingLeaves.length}`);
      
      // Check if any of the upcoming days have leaves
      const hasAnyUpcomingLeaves = upcomingLeaves.some(dayData => dayData.leaves.length > 0);
      
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
          const dateStr = dayData.date.format('Do MMM');
          const dayName = dayData.date.format('dddd');
          
          // Check if it's tomorrow
          const tomorrow = DateUtils.getCurrentDate().add(1, 'day').startOf('day');
          const isTomorrow = dayData.date.isSame(tomorrow, 'day');
          
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