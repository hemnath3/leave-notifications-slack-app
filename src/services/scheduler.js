const cron = require('node-cron');
const Leave = require('../models/Leave');
const Team = require('../models/Team');
const DateUtils = require('../utils/dateUtils');
const moment = require('moment-timezone');

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

    // Schedule daily morning notification at 3:22 PM AEST (for testing)
    cron.schedule('22 15 * * *', async () => {
          console.log('Running daily leave notification...');
    console.log('🔍 Scheduler: Starting daily notifications for all channels...');
    await this.sendDailyNotifications();
    console.log('🔍 Scheduler: Completed daily notifications for all channels.');
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
      console.log(`🔍 Scheduler: Found ${teams.length} teams`);
      teams.forEach((team, index) => {
        console.log(`🔍 Scheduler: Team ${index + 1}: ${team.teamName} (${team.channelId})`);
      });
      
      for (const team of teams) {
        console.log(`🔍 Scheduler: Processing team: ${team.teamName} (${team.channelId})`);
        await this.sendDailyNotificationForChannel(team.channelId);
        console.log(`🔍 Scheduler: Completed processing team: ${team.teamName} (${team.channelId})`);
      }
    } catch (error) {
      console.error('Error sending daily notifications:', error);
    }
  }

  async sendDailyNotificationForChannel(channelId) {
    try {
      // Use the exact same logic as send-reminder
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      console.log('🔍 Scheduler: Today:', today.toISOString().split('T')[0]);
      console.log('🔍 Scheduler: Tomorrow:', tomorrow.toISOString().split('T')[0]);
      
      const leaves = await Leave.find({
        $or: [
          { channelId: channelId }, // Leaves stored in this channel
          { 'notifiedChannels.channelId': channelId } // Leaves notified to this channel
        ],
        startDate: { $lte: tomorrow }, // Include leaves that start today or tomorrow
        endDate: { $gte: today }       // Include leaves that end today or later
      }).sort({ startDate: 1 });
      
      console.log('🔍 Scheduler: Found', leaves.length, 'leaves for channel', channelId);
      leaves.forEach(leave => {
        console.log('🔍 Scheduler: Leave -', leave.userName, '(', leave.startDate.toISOString().split('T')[0], 'to', leave.endDate.toISOString().split('T')[0], ')');
      });
      
      // Show only leaves that start today (not leaves that start tomorrow but overlap with today)
      const currentLeaves = leaves.filter(leave => {
        const startDate = new Date(leave.startDate);
        const startDateStr = startDate.toISOString().split('T')[0];
        return startDateStr === today.toISOString().split('T')[0]; // Only leaves that start exactly today
      });
      
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
              text: `📅 *Today's Team Availability* | ⏰ *${DateUtils.getCurrentTimeString()} AEST*`
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
        
        // Count only full-day leaves for summary and get unique members
        const fullDayLeaves = currentLeaves.filter(leave => {
          const startDate = new Date(leave.startDate);
          const endDate = new Date(leave.endDate);
          const isMultiDay = startDate.toDateString() !== endDate.toDateString();
          return isMultiDay || leave.isFullDay;
        });
        
        // Get unique members (in case someone has multiple leaves for the same date)
        const uniqueMembers = [...new Set(fullDayLeaves.map(leave => leave.userId))];
        
        // Add summary footer
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
          throw error; // Re-throw other errors
        }
      }
    } catch (error) {
      console.error('❌ Error sending daily notification:', error);
      try {
        await this.slackApp.client.chat.postMessage({
          channel: channelId,
          text: '⚠️ Daily leave notification failed. Please try the `/send-reminder` command manually.'
        });
      } catch (slackError) {
        console.error('❌ Could not send error message to channel:', slackError);
      }
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
        return false;
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