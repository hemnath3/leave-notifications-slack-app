const moment = require('moment-timezone');
const Leave = require('../models/Leave');
const TeamService = require('../services/TeamService');
const DateUtils = require('../utils/dateUtils');

module.exports = (app) => {
  // Loading actions.js module and registering handlers...
  

  
  // Handle modal submission
  app.view('leave_request_modal', async ({ ack, view, client, body }) => {
      // Modal submission handler called
    
    // If this is an edit modal, don't handle it here
    if (view.callback_id === 'edit_leave_modal') {
      console.log('🔍 Edit modal detected in leave_request_modal handler - ignoring');
      await ack();
      return;
    }
    
    // Client-side validation for "other" leave type
    const values = view.state.values;
    const leaveType = values.leave_type?.[Object.keys(values.leave_type || {})[0]]?.selected_option?.value;
    const reasonKey = Object.keys(values.reason || {})[0];
    const reason = reasonKey ? values.reason[reasonKey].value || '' : '';
    
    // Validate reason is required for "other" leave type
    if (leaveType === 'other' && (!reason || reason.trim() === '')) {
      await ack({
        response_action: 'errors',
        errors: {
          reason: 'Reason is required for "Other" leave type'
        }
      });
      return;
    }
    
    await ack();
    
    try {
      const metadata = JSON.parse(view.private_metadata);
      const values = view.state.values;
      
      // Extract form values with proper error handling
      
      // Extract values using dynamic key lookup (more robust approach)
      const leaveType = values.leave_type?.[Object.keys(values.leave_type || {})[0]]?.selected_option?.value;
      const isFullDay = values.is_full_day?.[Object.keys(values.is_full_day || {})[0]]?.selected_option?.value === 'true';
      
      // Extract dates using the first key from each object
      const startDateKey = Object.keys(values.start_date || {})[0];
      const endDateKey = Object.keys(values.end_date || {})[0];
      const startTimeKey = Object.keys(values.start_time || {})[0];
      const endTimeKey = Object.keys(values.end_time || {})[0];
      const reasonKey = Object.keys(values.reason || {})[0];
      const startDate = startDateKey ? values.start_date[startDateKey].selected_date : undefined;
      const endDate = endDateKey ? values.end_date[endDateKey].selected_date : undefined;
      const startTime = startTimeKey ? values.start_time[startTimeKey].selected_time || '09:00' : '09:00';
      const endTime = endTimeKey ? values.end_time[endTimeKey].selected_time || '17:00' : '17:00';
      const reason = reasonKey ? values.reason[reasonKey].value || '' : '';
      
      // Extract selected channels from dropdowns with duplicate prevention
      const selectedChannels = [];
      const selectedChannelIds = new Set(); // Track unique channel IDs
      
      // Channel 1 (pre-selected by default - current channel)
      const channel1Key = Object.keys(values.channel_1 || {})[0];
      if (channel1Key && values.channel_1[channel1Key].selected_option) {
        const channel1 = values.channel_1[channel1Key].selected_option;
        selectedChannels.push(channel1);
        selectedChannelIds.add(channel1.value);
      }
      
      // Channel 2
      const channel2Key = Object.keys(values.channel_2 || {})[0];
      if (channel2Key && values.channel_2[channel2Key].selected_option && values.channel_2[channel2Key].selected_option.value !== 'none') {
        const channel2 = values.channel_2[channel2Key].selected_option;
        if (!selectedChannelIds.has(channel2.value)) {
          selectedChannels.push(channel2);
          selectedChannelIds.add(channel2.value);
        }
      }
      
      // Channel 3
      const channel3Key = Object.keys(values.channel_3 || {})[0];
      if (channel3Key && values.channel_3[channel3Key].selected_option && values.channel_3[channel3Key].selected_option.value !== 'none') {
        const channel3 = values.channel_3[channel3Key].selected_option;
        if (!selectedChannelIds.has(channel3.value)) {
          selectedChannels.push(channel3);
          selectedChannelIds.add(channel3.value);
        }
      }
      
      // Channel 4
      const channel4Key = Object.keys(values.channel_4 || {})[0];
      if (channel4Key && values.channel_4[channel4Key].selected_option && values.channel_4[channel4Key].selected_option.value !== 'none') {
        const channel4 = values.channel_4[channel4Key].selected_option;
        if (!selectedChannelIds.has(channel4.value)) {
          selectedChannels.push(channel4);
          selectedChannelIds.add(channel4.value);
        }
      }
      
      // Extracted form values successfully
      
      // Validate leave type is selected
      if (!leaveType) {
        await client.chat.postEphemeral({
          channel: metadata.channelId,
          user: metadata.userId,
          text: '❌ Error: Please select a leave type.'
        });
        return;
      }
      
      // Validate dates
      if (!startDate || !endDate) {
        await client.chat.postEphemeral({
          channel: metadata.channelId,
          user: metadata.userId,
          text: '❌ Error: Please select both start and end dates.'
        });
        return;
      }
      
      const start = new Date(startDate + 'T00:00:00');
      const end = new Date(endDate + 'T00:00:00');
      const startOfToday = DateUtils.getCurrentDate().startOf('day');
      
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        await client.chat.postEphemeral({
          channel: metadata.channelId,
          user: metadata.userId,
          text: '❌ Error: Invalid date format. Please try again.'
        });
        return;
      }
      
      // Validate: No previous dates allowed (check against start of today)
      if (start < startOfToday.toDate()) {
        await client.chat.postEphemeral({
          channel: metadata.channelId,
          user: metadata.userId,
          text: `❌ **Date Error:** Start date (${DateUtils.formatDateForDisplay(start)}) cannot be in the past. Today is ${DateUtils.formatDateForDisplay(startOfToday.toDate())}.\n\n💡 **Tip:** Please select today or a future date for your leave.`
        });
        return;
      }
      
      // Validate: End date cannot be before start date
      if (end < start) {
        await client.chat.postEphemeral({
          channel: metadata.channelId,
          user: metadata.userId,
          text: `❌ **Date Error:** End date (${DateUtils.formatDateForDisplay(end)}) cannot be before start date (${DateUtils.formatDateForDisplay(start)}).\n\n💡 **Tip:** Please select an end date that is on or after your start date.`
        });
        return;
      }
      
      // Validate: Only "Other" leave type can be partial day
      if (!isFullDay && leaveType !== 'other') {
        await client.chat.postEphemeral({
          channel: metadata.channelId,
          user: metadata.userId,
          text: '❌ Error: Only "Other" leave type can be partial day. Please select "Full Day" for other leave types.'
        });
        return;
      }
      
      // Reason validation - mandatory for "other" leave type
      
      // Validate: Reason is mandatory for "other" leave type
      if (leaveType === 'other' && (!reason || reason.trim() === '')) {
        await client.chat.postEphemeral({
          channel: metadata.channelId,
          user: metadata.userId,
          text: '❌ Error: Reason is required for "Other" leave type. Please provide a reason for your leave.'
        });
        return;
      }
      
      // Validate: At least one channel must be selected
      if (selectedChannels.length === 0) {
        await client.chat.postEphemeral({
          channel: metadata.channelId,
          user: metadata.userId,
          text: '❌ Error: Please select at least one channel to notify about your leave.'
        });
        return;
      }
      
      // Validate: Maximum 3 channels allowed
      if (selectedChannels.length > 3) {
        await client.chat.postEphemeral({
          channel: metadata.channelId,
          user: metadata.userId,
          text: '❌ Error: You can only select up to 3 channels to notify about your leave.'
        });
        return;
      }
      
      // Validate: Check if bot is a member of all selected channels
      const invalidChannels = [];
      for (const channel of selectedChannels) {
        try {
          // Try to get channel info to check if bot is a member
          await client.conversations.info({
            channel: channel.value
          });
        } catch (error) {
          if (error.code === 'slack_webapi_platform_error' && error.data.error === 'not_in_channel') {
            invalidChannels.push(channel.text.text || channel.value);
          }
        }
      }
      
      if (invalidChannels.length > 0) {
        await client.chat.postEphemeral({
          channel: metadata.channelId,
          user: metadata.userId,
          text: `❌ Error: The bot is not a member of these channels: ${invalidChannels.join(', ')}. Please select only channels where the bot is installed.`
        });
        return;
      }
      
      // Save user's channel preferences for next time
      await TeamService.saveUserChannelPreferences(metadata.userId, selectedChannels.map(c => c.value));
      
      // Validate: Cannot apply leave more than 3 months in advance
      const threeMonthsFromNow = DateUtils.getThreeMonthsFromNow();
      if (start > threeMonthsFromNow.toDate()) {
        await client.chat.postEphemeral({
          channel: metadata.channelId,
          user: metadata.userId,
          text: '❌ Error: Cannot apply leave more than 3 months in advance.'
        });
        return;
      }
      
      // Calculate working days for display
      const workingDays = DateUtils.getWorkingDays(start, end);
      
      // Get channel information for selected channels (with rate limiting)
      const channelInfo = await Promise.allSettled(
        selectedChannels.map(async (channelOption, index) => {
          const channelId = channelOption.value;
          
          // Add small delay between API calls to avoid rate limiting
          if (index > 0) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          
          try {
            const channelData = await client.conversations.info({ channel: channelId });
            return {
              channelId,
              channelName: channelData.channel.name,
              isPrivate: channelData.channel.is_private || false
            };
          } catch (error) {
            console.log(`⚠️ Could not get channel info for ${channelId}:`, error.message);
            return {
              channelId,
              channelName: 'Unknown Channel',
              isPrivate: false
            };
          }
        })
      ).then(results => results.map(result => 
        result.status === 'fulfilled' ? result.value : {
          channelId: selectedChannels[results.indexOf(result)].value,
          channelName: 'Unknown Channel',
          isPrivate: false
        }
      ));
      
      // Auto-add user to source channel team
      await TeamService.autoAddUserToTeam(metadata.channelId, metadata.channelName, {
        userId: metadata.userId,
        userName: metadata.userName,
        userEmail: metadata.userEmail
      });
      
      // Auto-add user to all notified channel teams (with error handling)
      const teamPromises = channelInfo.map(async (channel) => {
        try {
          await TeamService.autoAddUserToTeam(channel.channelId, channel.channelName, {
            userId: metadata.userId,
            userName: metadata.userName,
            userEmail: metadata.userEmail
          });
        } catch (error) {
          console.log(`⚠️ Could not add user to team ${channel.channelName}:`, error.message);
          // Continue with other channels even if one fails
        }
      });
      
      // Wait for all team additions to complete (but don't fail if some fail)
      await Promise.allSettled(teamPromises);
      
      // Create single leave record in source channel with notified channels
      console.log('🔍 Creating leave with notified channels - Source:', metadata.channelName, '(', metadata.channelId, ')');
      console.log('🔍 Creating leave with notified channels - Notified to:', channelInfo.map(ch => ch.channelName + '(' + ch.channelId + ')').join(', '));
      
      const leave = new Leave({
        userId: metadata.userId,
        userName: metadata.userName,
        userEmail: metadata.userEmail || 'not-provided@example.com',
        leaveType,
        startDate: start,
        endDate: end,
        startTime: isFullDay ? '09:00' : startTime,
        endTime: isFullDay ? '17:00' : endTime,
        isFullDay,
        reason: reason.trim() || '',
        channelId: metadata.channelId,
        channelName: metadata.channelName,
        notifiedChannels: channelInfo.map(ch => ({
          channelId: ch.channelId,
          channelName: ch.channelName
        }))
      });
      
      // Special handling for "other" partial-day leaves - check for time conflicts
      if (leaveType === 'other' && !isFullDay) {
        console.log('🔍 Checking for time conflicts with existing "other" partial-day leaves');
        
        // Find existing "other" partial-day leaves for the same user, channel, and date
        const existingOtherLeaves = await Leave.find({
          userId: metadata.userId,
          channelId: metadata.channelId,
          leaveType: 'other',
          isFullDay: false,
          startDate: { $lte: end },
          endDate: { $gte: start }
        });
        
        console.log(`🔍 Found ${existingOtherLeaves.length} existing "other" partial-day leaves`);
        
        // Check for time conflicts
        for (const existingLeave of existingOtherLeaves) {
          const existingStart = moment(existingLeave.startDate).tz('Australia/Sydney');
          const existingEnd = moment(existingLeave.endDate).tz('Australia/Sydney');
          
          // If same date, check time overlap
          if (existingStart.format('YYYY-MM-DD') === startDate) {
            const existingStartTime = existingLeave.startTime;
            const existingEndTime = existingLeave.endTime;
            
            console.log(`🔍 Comparing times: New (${startTime}-${endTime}) vs Existing (${existingStartTime}-${existingEndTime})`);
            
            // Check if time periods overlap
            const newStartMinutes = parseInt(startTime.split(':')[0]) * 60 + parseInt(startTime.split(':')[1]);
            const newEndMinutes = parseInt(endTime.split(':')[0]) * 60 + parseInt(endTime.split(':')[1]);
            const existingStartMinutes = parseInt(existingStartTime.split(':')[0]) * 60 + parseInt(existingStartTime.split(':')[1]);
            const existingEndMinutes = parseInt(existingEndTime.split(':')[0]) * 60 + parseInt(existingEndTime.split(':')[1]);
            
            // Check for overlap: new start < existing end AND new end > existing start
            if (newStartMinutes < existingEndMinutes && newEndMinutes > existingStartMinutes) {
              await client.chat.postEphemeral({
                channel: metadata.channelId,
                user: metadata.userId,
                text: `❌ Time conflict detected! You already have an "other" leave from ${existingStartTime} to ${existingEndTime} on ${DateUtils.formatDateForDisplay(startDate)}. Please choose a different time period.`
              });
              return;
            }
          }
        }
        
        console.log('✅ No time conflicts found - allowing multiple "other" partial-day leaves');
      }
      
      // Save the leave record with duplicate handling
      let saveSuccessful = false;
      
      try {
        await leave.save();
        saveSuccessful = true;
        console.log('✅ Leave saved successfully with notified channels count:', leave.notifiedChannels.length);
        console.log('✅ Leave saved successfully with notified channels:', leave.notifiedChannels.map(ch => ch.channelName + '(' + ch.channelId + ')').join(', '));
      } catch (error) {
        if (error.code === 11000) {
          // Duplicate key error - user already has a leave of the same type for this date range in this channel
          console.log('❌ Duplicate leave detected for user:', metadata.userId, 'channel:', metadata.channelId, 'date:', startDate, 'to', endDate, 'type:', leaveType);
          
          // For "other" partial-day leaves, try to save with a slightly modified timestamp to bypass unique constraint
          if (leaveType === 'other' && !isFullDay) {
            console.log('✅ Attempting to save "other" partial-day leave with modified timestamp');
            try {
              // Add 1 second to the start time to make it unique
              leave.startDate = new Date(leave.startDate.getTime() + 1000);
              await leave.save();
              saveSuccessful = true;
              console.log('✅ "Other" partial-day leave saved successfully with modified timestamp');
            } catch (retryError) {
              console.error('❌ Failed to save "other" partial-day leave even with modified timestamp:', retryError);
              await client.chat.postEphemeral({
                channel: metadata.channelId,
                user: metadata.userId,
                text: '❌ Failed to save leave request. Please try again.'
              });
              return;
            }
          } else {
            // Check what existing leave exists of the same type
            try {
              const existingLeave = await Leave.findOne({
                userId: metadata.userId,
                startDate: { $lte: end },
                endDate: { $gte: start },
                channelId: metadata.channelId,
                leaveType: leaveType
              });
              
              if (existingLeave) {
                const existingStart = DateUtils.formatDateForDisplay(existingLeave.startDate);
                const existingEnd = DateUtils.formatDateForDisplay(existingLeave.endDate);
                await client.chat.postEphemeral({
                  channel: metadata.channelId,
                  user: metadata.userId,
                  text: `❌ You already have a ${leaveType} leave request for ${existingStart} to ${existingEnd} in this channel. You can submit a different leave type for the same date.`
                });
              } else {
                await client.chat.postEphemeral({
                  channel: metadata.channelId,
                  user: metadata.userId,
                  text: `❌ You already have a ${leaveType} leave request for this date range in this channel. You can submit a different leave type for the same date.`
                });
              }
            } catch (checkError) {
              console.error('❌ Error checking existing leaves:', checkError);
              await client.chat.postEphemeral({
                channel: metadata.channelId,
                user: metadata.userId,
                text: `❌ You already have a ${leaveType} leave request for this date range in this channel. You can submit a different leave type for the same date.`
              });
            }
            return;
          }
        } else {
          throw error; // Re-throw other errors
        }
      }
      
      // Send confirmation message
      const startDateStr = DateUtils.formatDateForDisplay(start);
      const endDateStr = DateUtils.formatDateForDisplay(end);
      const duration = isFullDay ? `Full Day (${workingDays} working days)` : `${startTime} - ${endTime}`;
      

      
      // Send confirmation to user
      try {
        const reasonDisplay = reason.trim() || (leaveType === 'other' ? 'No reason provided' : 'N/A');
        const channelList = channelInfo.map(ch => `${ch.isPrivate ? '🔒' : '#'}${ch.channelName}`).join(', ');
        
        await client.chat.postEphemeral({
          channel: metadata.channelId,
          user: metadata.userId,
          text: `✅ Your leave notification has been saved successfully!\n\n*Details:*\n• Type: ${leaveType.charAt(0).toUpperCase() + leaveType.slice(1)}\n• Date: ${startDateStr} - ${endDateStr}\n• Duration: ${duration}\n• Reason: ${reasonDisplay}\n• Notified Channels: ${channelList}\n\nYour leave will be included in the daily reminder at 9 AM for the selected channels.`
        });
      } catch (userError) {
        console.log('⚠️ Could not send confirmation to user, but leave was saved successfully');
        // Try to send a direct message as fallback
        try {
          await client.chat.postMessage({
            channel: metadata.userId,
            text: `✅ Your leave notification has been saved successfully!\n\n*Details:*\n• Type: ${leaveType.charAt(0).toUpperCase() + leaveType.slice(1)}\n• Date: ${startDateStr} - ${endDateStr}\n• Duration: ${duration}\n• Reason: ${reasonDisplay}\n\nYour leave will be included in the daily reminder at 9 AM.`
          });
        } catch (dmError) {
          console.log('⚠️ Could not send DM either, but leave was saved successfully');
        }
      }
      
    } catch (error) {
      console.error('❌ Error processing leave request:', error);
      console.error('❌ Error details:', {
        message: error.message,
        stack: error.stack,
        view: view ? 'view exists' : 'no view',
        metadata: view?.private_metadata
      });
      
      try {
        const errorMetadata = JSON.parse(view?.private_metadata || '{}');
        if (errorMetadata?.channelId && errorMetadata?.userId) {
          await client.chat.postEphemeral({
            channel: errorMetadata.channelId,
            user: errorMetadata.userId,
            text: '❌ Sorry, there was an error processing your leave request. Please try again.'
          });
        }
      } catch (metadataError) {
        console.error('❌ Error sending error message:', metadataError);
      }
    }
  });

  // Handle manage leave button click
  console.log('🔍 Registering manage_leave action handler');
  app.action('manage_leave', async ({ ack, body, client }) => {
    console.log('🔍 Manage leave action handler called');
    console.log('🔍 Action body:', JSON.stringify(body, null, 2));
    await ack();
    
    try {
      const leaveId = body.actions[0].value;
      const userId = body.user.id;
      
      console.log('🔍 Manage leave requested for leave ID:', leaveId, 'by user:', userId);
      
      // Get the leave details
      const leave = await Leave.findById(leaveId);
      
      if (!leave) {
        await client.chat.postEphemeral({
          channel: body.channel.id,
          user: userId,
          text: '❌ Leave not found. It may have been deleted already.'
        });
        return;
      }
      
      // Check if user owns this leave
      if (leave.userId !== userId) {
        await client.chat.postEphemeral({
          channel: body.channel.id,
          user: userId,
          text: '❌ You can only manage your own leaves.'
        });
        return;
      }
      
      // Create management modal
      const startDate = new Date(leave.startDate);
      const endDate = new Date(leave.endDate);
      
      await client.views.open({
        trigger_id: body.trigger_id,
        view: {
          type: 'modal',
          callback_id: 'manage_leave_modal',
          title: {
            type: 'plain_text',
            text: 'Manage Leave',
            emoji: true
          },
          close: {
            type: 'plain_text',
            text: 'Close',
            emoji: true
          },
          private_metadata: JSON.stringify({
            leaveId: leaveId,
            userId: userId,
            channelId: body.channel.id
          }),
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*Current Leave Details:*\n• Type: ${leave.leaveType.charAt(0).toUpperCase() + leave.leaveType.slice(1)}\n• Date: ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}\n• Duration: ${leave.isFullDay ? 'Full Day' : `${leave.startTime} - ${leave.endTime}`}\n• Reason: ${leave.reason || 'None'}`
              }
            },
            {
              type: 'divider'
            },
            {
              type: 'actions',
              elements: [
                {
                  type: 'button',
                  text: {
                    type: 'plain_text',
                    text: '🗑️ Delete Leave',
                    emoji: true
                  },
                  style: 'danger',
                  action_id: 'delete_leave',
                  value: leaveId
                }
              ]
            }
          ]
        }
      });
      
    } catch (error) {
      console.error('❌ Error opening manage leave modal:', error);
      await client.chat.postEphemeral({
        channel: body.channel.id,
        user: body.user.id,
        text: '❌ Sorry, there was an error opening the management options. Please try again.'
      });
    }
  });

  // Handle delete leave action
  console.log('🔍 Registering delete_leave action handler');
  app.action('delete_leave', async ({ ack, body, client }) => {
    console.log('🔍 Delete leave action handler called');
    console.log('🔍 Action body:', JSON.stringify(body, null, 2));
    await ack();
    
    try {
      const leaveId = body.actions[0].value;
      const userId = body.user.id;
      
      console.log('🗑️ Delete leave requested for leave ID:', leaveId, 'by user:', userId);
      
      // Get the leave details
      const leave = await Leave.findById(leaveId);
      
      if (!leave) {
        await client.chat.postEphemeral({
          channel: body.channel.id,
          user: userId,
          text: '❌ Leave not found. It may have been deleted already.'
        });
        return;
      }
      
      // Check if user owns this leave
      if (leave.userId !== userId) {
        await client.chat.postEphemeral({
          channel: body.channel.id,
          user: userId,
          text: '❌ You can only delete your own leaves.'
        });
        return;
      }
      
      // Delete the leave
      await Leave.findByIdAndDelete(leaveId);
      
      console.log('✅ Leave deleted successfully:', leaveId);
      
      // Try to send ephemeral message first
      try {
        await client.chat.postEphemeral({
          channel: body.channel.id,
          user: userId,
          text: `✅ Your leave has been deleted successfully!\n\n*Deleted Leave:*\n• Type: ${leave.leaveType.charAt(0).toUpperCase() + leave.leaveType.slice(1)}\n• Date: ${new Date(leave.startDate).toLocaleDateString()} - ${new Date(leave.endDate).toLocaleDateString()}`
        });
      } catch (ephemeralError) {
        console.log('⚠️ Could not send ephemeral message, trying DM:', ephemeralError.message);
        // Fallback to DM
        try {
          await client.chat.postMessage({
            channel: userId,
            text: `✅ Your leave has been deleted successfully!\n\n*Deleted Leave:*\n• Type: ${leave.leaveType.charAt(0).toUpperCase() + leave.leaveType.slice(1)}\n• Date: ${new Date(leave.startDate).toLocaleDateString()} - ${new Date(leave.endDate).toLocaleDateString()}`
          });
        } catch (dmError) {
          console.error('❌ Could not send DM either:', dmError);
        }
      }
      
      // Close the modal
      try {
        await client.views.update({
          view_id: body.view?.id,
          view: {
            type: 'modal',
            title: {
              type: 'plain_text',
              text: 'Leave Deleted',
              emoji: true
            },
            blocks: [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `✅ *Leave deleted successfully!*\n\n*Deleted Leave:*\n• Type: ${leave.leaveType.charAt(0).toUpperCase() + leave.leaveType.slice(1)}\n• Date: ${new Date(leave.startDate).toLocaleDateString()} - ${new Date(leave.endDate).toLocaleDateString()}`
                }
              }
            ]
          }
        });
      } catch (updateError) {
        console.log('⚠️ Could not update modal view:', updateError.message);
      }
      
    } catch (error) {
      console.error('❌ Error deleting leave:', error);
      await client.chat.postEphemeral({
        channel: body.channel.id,
        user: body.user.id,
        text: '❌ Sorry, there was an error deleting your leave. Please try again.'
      });
    }
  });





  // Handle delete leave button clicks from /my-leaves
  app.action(/^delete_leave_(.+)$/, async ({ ack, body, client }) => {
    await ack();
    
    try {
      const leaveId = body.actions[0].value;
      const userId = body.user.id;
      
      console.log(`🔍 Delete leave request: ${leaveId} by user ${userId}`);
      
      // Find the leave
      const leave = await Leave.findById(leaveId);
      if (!leave) {
        await client.chat.postEphemeral({
          channel: body.channel.id,
          user: userId,
          text: '❌ Leave not found. It may have been deleted already.'
        });
        return;
      }
      
      // Check if user owns this leave
      if (leave.userId !== userId) {
        await client.chat.postEphemeral({
          channel: body.channel.id,
          user: userId,
          text: '❌ You can only delete your own leaves.'
        });
        return;
      }
      
      // Delete the leave
      await Leave.findByIdAndDelete(leaveId);
      
      console.log('✅ Leave deleted successfully:', leaveId);
      
      // Send confirmation
      await client.chat.postEphemeral({
        channel: body.channel.id,
        user: userId,
        text: `✅ Your leave has been deleted successfully!\n\n*Deleted Leave:*\n• Type: ${leave.leaveType.charAt(0).toUpperCase() + leave.leaveType.slice(1)}\n• Date: ${moment(leave.startDate).tz('Australia/Sydney').format('DD/MM/YYYY')} - ${moment(leave.endDate).tz('Australia/Sydney').format('DD/MM/YYYY')}`
      });
      
    } catch (error) {
      console.error('❌ Error deleting leave:', error);
      await client.chat.postEphemeral({
        channel: body.channel.id,
        user: body.user.id,
        text: '❌ Sorry, there was an error deleting your leave. Please try again.'
      });
    }
  });

  // Handle manage leave modal submission (fallback for any submit button)
  app.view('manage_leave_modal', async ({ ack, view, client, body }) => {
    console.log('🔍 Manage leave modal submission handler called');
    await ack();
    
    try {
      const metadata = JSON.parse(view.private_metadata);
      
      await client.chat.postEphemeral({
        channel: metadata.channelId,
        user: metadata.userId,
        text: 'ℹ️ This modal is for viewing leave details only. Use the "Delete Leave" button to remove leaves.'
      });
      
    } catch (error) {
      console.error('❌ Error in manage leave modal submission:', error);
    }
  });

}; 