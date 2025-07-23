const cron = require('node-cron');
const moment = require('moment-timezone');
const Leave = require('../models/Leave');
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

    // Schedule daily morning notification at 9:00 AM AEST
    cron.schedule('0 9 * * *', async () => {
      console.log('Running daily leave notification...');
      await this.sendDailyNotifications();
    }, {
      timezone: 'Australia/Sydney'
    });

    // Schedule weekly summary on Monday at 9:00 AM AEST
    cron.schedule('0 9 * * 1', async () => {
      console.log('Running weekly leave summary...');
      await this.sendWeeklySummary();
    }, {
      timezone: 'Australia/Sydney'
    });

    this.isRunning = true;
    console.log('Notification scheduler started');
  }

  async sendDailyNotifications() {
    try {
      // Get all unique channels that have leaves
      const channels = await Leave.distinct('channelId');
      
      for (const channelId of channels) {
        await this.sendDailyNotificationForChannel(channelId);
      }
    } catch (error) {
      console.error('Error sending daily notifications:', error);
    }
  }

  async sendDailyNotificationForChannel(channelId) {
    try {
      const today = DateUtils.getCurrentDate().startOf('day').toDate();
      const tomorrow = DateUtils.getCurrentDate().add(1, 'day').startOf('day').toDate();
      
      // Get leaves for today from this specific channel
      const leaves = await Leave.find({
        channelId: channelId,
        startDate: { $lte: tomorrow },
        endDate: { $gte: today }
      }).sort({ startDate: 1 });
      
      if (leaves.length === 0) {
        // Send a message that no one is on leave today
        await this.slackApp.client.chat.postMessage({
          channel: channelId,
          text: '📅 No team members are away today! Everyone is available. 🎉'
        });
        return;
      }

      // Group leaves by date
      const leavesByDate = {};
      leaves.forEach(leave => {
        const start = new Date(leave.startDate);
        const end = new Date(leave.endDate);
        
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          const dateKey = d.toISOString().split('T')[0];
          if (!leavesByDate[dateKey]) {
            leavesByDate[dateKey] = [];
          }
          leavesByDate[dateKey].push(leave);
        }
      });
      
      // Send reminder for today
      const todayKey = today.toISOString().split('T')[0];
      const todaysLeaves = leavesByDate[todayKey] || [];
      
      // Only show leaves that start today or in the future (not past leaves)
      const currentLeaves = todaysLeaves.filter(leave => {
        const startDate = new Date(leave.startDate);
        const startDateStr = startDate.toISOString().split('T')[0];
        return startDateStr >= todayKey;
      });
      
      if (currentLeaves.length === 0) {
        await this.slackApp.client.chat.postMessage({
          channel: channelId,
          text: '📅 No team members are away today! Everyone is available. 🎉'
        });
        return;
      }
      
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
              text: `📅 *${DateUtils.getCurrentDate().format('dddd, MMMM Do, YYYY')}* | ⏰ *${DateUtils.getCurrentTimeString()} AEST*`
            }
          ]
        },
        {
          type: 'divider'
        }
      ];
      
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
      
      // Add summary footer
      if (fullDayLeaves.length > 0) {
        blocks.push({
          type: 'divider'
        });
        blocks.push({
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `📊 *${fullDayLeaves.length} team member${fullDayLeaves.length === 1 ? '' : 's'} away today*`
            }
          ]
        });
      }
      
      // Add upcoming leaves section
      console.log('🔄 About to add upcoming leaves section...');
      await this.addUpcomingLeavesSection(blocks, channelId);
      console.log('✅ Upcoming leaves section added');
      

      
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
    } catch (error) {
      console.error(`Error processing daily notification for channel ${channelId}:`, error);
    }
  }

  async sendWeeklySummary() {
    try {
      const channels = await Leave.distinct('channelId');
      
      for (const channelId of channels) {
        await this.sendWeeklySummaryForChannel(channelId);
      }
    } catch (error) {
      console.error('Error sending weekly summary:', error);
    }
  }

  async sendWeeklySummaryForChannel(channelId) {
    try {
      const startOfWeek = moment().startOf('week').toDate();
      const endOfWeek = moment().endOf('week').toDate();
      
      const leaves = await Leave.getLeavesForDateRange(startOfWeek, endOfWeek, channelId);
      
      if (leaves.length === 0) {
        await this.slackApp.client.chat.postMessage({
          channel: channelId,
          text: '📅 Weekly Leave Summary: No leaves scheduled this week.',
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: '📅 *Weekly Leave Summary*\n\nNo leaves scheduled for this week! 🎉'
              }
            }
          ]
        });
        return;
      }

      // Group by day
      const leavesByDay = {};
      leaves.forEach(leave => {
        const start = moment(leave.startDate);
        const end = moment(leave.endDate);
        
        for (let day = start.clone(); day.isSameOrBefore(end); day.add(1, 'day')) {
          const dayKey = day.format('YYYY-MM-DD');
          if (!leavesByDay[dayKey]) {
            leavesByDay[dayKey] = [];
          }
          leavesByDay[dayKey].push(leave);
        }
      });

      const blocks = [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '📅 Weekly Leave Summary',
            emoji: true
          }
        },
        {
          type: 'divider'
        }
      ];

      // Add leaves by day
      Object.entries(leavesByDay)
        .sort(([a], [b]) => a.localeCompare(b))
        .forEach(([date, dayLeaves]) => {
          const dayName = moment(date).format('dddd, MMM D');
          const uniqueLeaves = [...new Map(dayLeaves.map(l => [l.userId, l])).values()];
          
          const leaveList = uniqueLeaves.map(leave => {
            const duration = leave.isFullDay ? 'Full Day' : `${leave.startTime} - ${leave.endTime}`;
            const status = leave.status === 'approved' ? '✅' : '⏳';
            const emoji = this.getLeaveTypeEmoji(leave.leaveType);
            
            return `• ${status} ${emoji} *${leave.userName}* (${duration})`;
          }).join('\n');

          blocks.push({
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*${dayName}*\n${leaveList}`
            }
          });
        });

      // Add summary
      const totalLeaves = leaves.length;
      const uniqueUsers = [...new Set(leaves.map(l => l.userId))].length;

      blocks.push({
        type: 'divider'
      });

      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `📊 *Weekly Summary:* ${totalLeaves} leave requests from ${uniqueUsers} people`
        }
      });

      try {
        await this.slackApp.client.chat.postMessage({
          channel: channelId,
          text: '📅 Weekly Leave Summary',
          blocks: blocks
        });
      } catch (error) {
        if (error.code === 'slack_webapi_platform_error' && error.data.error === 'not_in_channel') {
          console.log(`⚠️ App is not a member of channel ${channelId}. Skipping weekly summary.`);
        } else {
          console.error(`Error sending weekly summary for channel ${channelId}:`, error);
        }
      }
    } catch (error) {
      console.error(`Error processing weekly summary for channel ${channelId}:`, error);
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
          channelId: channelId,
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
        
        if (filteredLeaves.length > 0) {
          upcomingLeaves.push({
            date: date,
            leaves: filteredLeaves
          });
        }
        
        if (leaves.length > 0) {
          upcomingLeaves.push({
            date: date,
            leaves: leaves
          });
        }
      }
      
      console.log(`📊 Total upcoming leaves found: ${upcomingLeaves.length}`);
      
      if (upcomingLeaves.length > 0) {
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
    } catch (error) {
      console.error('Error adding upcoming leaves section:', error);
    }
  }

  stop() {
    this.isRunning = false;
    console.log('Notification scheduler stopped');
  }
}

module.exports = NotificationScheduler; 