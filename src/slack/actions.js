const Leave = require('../models/Leave');
const DateUtils = require('../utils/dateUtils');

module.exports = (app) => {
  console.log('🔍 Loading actions.js module and registering handlers...');
  
  // Catch-all modal submission handler for debugging (MUST BE FIRST)
  app.view('*', async ({ ack, view, client, body }) => {
    console.log('🔍 CATCH-ALL MODAL HANDLER CALLED');
    console.log('🔍 Callback ID:', view.callback_id);
    console.log('🔍 View type:', view.type);
    await ack();
  });
  
  // Handle modal submission
  app.view('leave_request_modal', async ({ ack, view, client, body }) => {
    console.log('🔍 Modal submission handler called');
    console.log('🔍 Callback ID:', view.callback_id);
    console.log('🔍 ALL MODAL SUBMISSIONS GO THROUGH HERE FIRST');
    
    // If this is an edit modal, don't handle it here
    if (view.callback_id === 'edit_leave_modal') {
      console.log('🔍 Edit modal detected in leave_request_modal handler - ignoring');
      await ack();
      return;
    }
    
    await ack();
    
    try {
      const metadata = JSON.parse(view.private_metadata);
      const values = view.state.values;
      
      // Extract form values with proper error handling
      console.log('🔍 Form values structure:', JSON.stringify(values, null, 2));
      
      // Extract values using dynamic key lookup (more robust approach)
      const leaveType = values.leave_type?.[Object.keys(values.leave_type || {})[0]]?.selected_option?.value || 'other';
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
      
      console.log('🔍 Extracted values:', {
        leaveType,
        isFullDay,
        startDate,
        endDate,
        startTime,
        endTime,
        reason
      });
      
      console.log('🔍 Modal submission received:', {
        leaveType,
        isFullDay,
        startDate,
        endDate,
        startTime,
        endTime,
        reason,
        metadata
      });
      
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
      
      // Validate: Reason is required for "Other" leave type
      if (leaveType === 'other' && (!reason || reason.trim() === '')) {
        await client.chat.postEphemeral({
          channel: metadata.channelId,
          user: metadata.userId,
          text: '❌ Error: Reason is required for "Other" leave type. Please provide a reason.'
        });
        return;
      }
      
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
      
      // Create leave record
      const leave = new Leave({
        userId: metadata.userId,
        userName: metadata.userName,
        userEmail: metadata.userEmail || 'not-provided@example.com', // Provide default if empty
        leaveType,
        startDate: start,
        endDate: end,
        startTime: isFullDay ? '09:00' : startTime,
        endTime: isFullDay ? '17:00' : endTime,
        isFullDay,
        reason: reason.trim() || 'No reason provided', // Provide default for non-Other leave types
        channelId: metadata.channelId,
        channelName: metadata.channelName
      });
      

      
      // Save leave
      await leave.save();
      
      // Send confirmation message
      const startDateStr = DateUtils.formatDateForDisplay(start);
      const endDateStr = DateUtils.formatDateForDisplay(end);
      const duration = isFullDay ? `Full Day (${workingDays} working days)` : `${startTime} - ${endTime}`;
      

      
      // Send confirmation to user
      try {
        const reasonDisplay = reason.trim() || 'No reason provided';
        await client.chat.postEphemeral({
          channel: metadata.channelId,
          user: metadata.userId,
          text: `✅ Your leave notification has been saved successfully!\n\n*Details:*\n• Type: ${leaveType.charAt(0).toUpperCase() + leaveType.slice(1)}\n• Date: ${startDateStr} - ${endDateStr}\n• Duration: ${duration}\n• Reason: ${reasonDisplay}\n\nYour leave will be included in the daily reminder at 9 AM.`
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
                    text: 'Edit Leave',
                    emoji: true
                  },
                  style: 'primary',
                  action_id: 'edit_leave',
                  value: leaveId
                },
                {
                  type: 'button',
                  text: {
                    type: 'plain_text',
                    text: 'Delete Leave',
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

  // Handle edit leave action
  console.log('🔍 Registering edit_leave action handler');
  app.action('edit_leave', async ({ ack, body, client }) => {
    console.log('🔍 EDIT LEAVE ACTION HANDLER CALLED - THIS SHOULD APPEAR');
    console.log('🔍 Edit leave action handler called');
    console.log('🔍 Action body:', JSON.stringify(body, null, 2));
    await ack();
    console.log('🔍 Acknowledged edit action');
    
    try {
      console.log('🔍 Starting edit leave processing');
      const leaveId = body.actions[0].value;
      const userId = body.user.id;
      
      console.log('✏️ Edit leave requested for leave ID:', leaveId, 'by user:', userId);
      
      // Get the leave details
      console.log('🔍 Looking up leave in database');
      const leave = await Leave.findById(leaveId);
      console.log('🔍 Leave lookup result:', leave ? 'Found' : 'Not found');
      
      if (!leave) {
        // Handle different channel contexts (DM vs channel)
        const channelId = body.channel?.id || body.channel || userId;
        await client.chat.postEphemeral({
          channel: channelId,
          user: userId,
          text: '❌ Leave not found. It may have been deleted already.'
        });
        return;
      }
      
      // Check if user owns this leave
      if (leave.userId !== userId) {
        // Handle different channel contexts (DM vs channel)
        const channelId = body.channel?.id || body.channel || userId;
        await client.chat.postEphemeral({
          channel: channelId,
          user: userId,
          text: '❌ You can only edit your own leaves.'
        });
        return;
      }
      
      // Open simple edit modal with just date checkboxes
      console.log('🔍 Opening simple edit modal with date checkboxes');
      const startDate = new Date(leave.startDate);
      const endDate = new Date(leave.endDate);
      
      // Handle different channel contexts (DM vs channel)
      const channelId = body.channel?.id || body.channel || userId;
      console.log('🔍 Channel ID for modal:', channelId);
      
      console.log('🔍 About to open modal with trigger_id:', body.trigger_id);
      const result = await client.views.open({
        trigger_id: body.trigger_id,
        view: {
          type: 'modal',
          callback_id: 'edit_leave_modal',
          title: {
            type: 'plain_text',
            text: 'Edit Leave Dates',
            emoji: true
          },
          submit: {
            type: 'plain_text',
            text: 'Update Dates',
            emoji: true
          },
          close: {
            type: 'plain_text',
            text: 'Cancel',
            emoji: true
          },
          private_metadata: JSON.stringify({
            leaveId: leaveId,
            userId: userId,
            channelId: channelId,
            originalLeave: JSON.stringify(leave)
          }),
          blocks: [
            {
              type: 'context',
              elements: [
                {
                  type: 'mrkdwn',
                  text: '✏️ *Simple Date Edit:* You can only change the start and end dates. All other details will remain unchanged.'
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
                text: `*Current Leave Details (unchanged):*\n• Type: ${leave.leaveType.charAt(0).toUpperCase() + leave.leaveType.slice(1)}\n• Duration: ${leave.isFullDay ? 'Full Day' : 'Partial Day'}\n• Times: ${leave.startTime} - ${leave.endTime}\n• Reason: ${leave.reason || 'None'}`
              }
            },
            {
              type: 'divider'
            },
            {
              type: 'input',
              block_id: 'start_date',
              label: {
                type: 'plain_text',
                text: 'Start Date',
                emoji: true
              },
              element: {
                type: 'datepicker',
                placeholder: {
                  type: 'plain_text',
                  text: 'Select start date',
                  emoji: true
                },
                initial_date: startDate.toISOString().split('T')[0]
              },
              hint: {
                type: 'plain_text',
                text: '📅 Select today or a future date (max 3 months ahead)',
                emoji: true
              }
            },
            {
              type: 'input',
              block_id: 'end_date',
              label: {
                type: 'plain_text',
                text: 'End Date',
                emoji: true
              },
              element: {
                type: 'datepicker',
                placeholder: {
                  type: 'plain_text',
                  text: 'Select end date',
                  emoji: true
                },
                initial_date: endDate.toISOString().split('T')[0]
              },
              hint: {
                type: 'plain_text',
                text: '📅 Select a date on or after start date (max 3 months ahead)',
                emoji: true
              }
            }
          ]
        }
      });
      
      console.log('🔍 Simple edit modal opened successfully');
      console.log('🔍 Modal result:', JSON.stringify(result, null, 2));
      
    } catch (error) {
      console.error('❌ Error handling edit leave action:', error);
      console.error('❌ Error details:', {
        message: error.message,
        stack: error.stack
      });
      
      // Try to send error message to user
      try {
        const channelId = body.channel?.id || body.channel || body.user.id;
        await client.chat.postEphemeral({
          channel: channelId,
          user: body.user.id,
          text: '❌ Sorry, there was an error processing your edit request. Please try again.'
        });
      } catch (ephemeralError) {
        console.error('❌ Could not send error message:', ephemeralError);
      }
    }
  });

  // Handle edit leave modal submission (simplified - only leave type and dates)
  console.log('🔍 Registering edit_leave_modal view handler');
  console.log('🔍 About to register app.view("edit_leave_modal", ...)');
  app.view('edit_leave_modal', async ({ ack, view, client, body }) => {
    console.log('🔍 Edit leave modal submission handler called');
    console.log('🔍 View data:', JSON.stringify(view, null, 2));
    await ack();
    
    // Send immediate test message to confirm handler is called
    try {
      const metadata = JSON.parse(view.private_metadata);
      await client.chat.postEphemeral({
        channel: metadata.channelId,
        user: metadata.userId,
        text: '🔍 Edit modal submission handler is working! Processing your request...'
      });
    } catch (error) {
      console.error('❌ Error sending test message:', error);
    }
    
    try {
      const metadata = JSON.parse(view.private_metadata);
      const values = view.state.values;
      const originalLeave = JSON.parse(metadata.originalLeave);
      
      console.log('🔍 Edit form values structure:', JSON.stringify(values, null, 2));
      
      // Extract only dates (leave type remains unchanged)
      const startDateKey = Object.keys(values.start_date || {})[0];
      const endDateKey = Object.keys(values.end_date || {})[0];
      
      const startDate = startDateKey ? values.start_date[startDateKey].selected_date : undefined;
      const endDate = endDateKey ? values.end_date[endDateKey].selected_date : undefined;
      
      console.log('🔍 Extracted edit values:', { startDate, endDate });
      
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
      
      // Validate: No previous dates allowed
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
      
      // Update only dates, preserve everything else
      const updatedLeave = await Leave.findByIdAndUpdate(
        metadata.leaveId,
        {
          startDate: start,
          endDate: end
          // Keep original: leaveType, isFullDay, startTime, endTime, reason
        },
        { new: true }
      );
      
      if (!updatedLeave) {
        await client.chat.postEphemeral({
          channel: metadata.channelId,
          user: metadata.userId,
          text: '❌ Error: Leave not found or could not be updated. Please try again.'
        });
        return;
      }
      
      // Send confirmation message
      const startDateStr = DateUtils.formatDateForDisplay(start);
      const endDateStr = DateUtils.formatDateForDisplay(end);
      
      await client.chat.postEphemeral({
        channel: metadata.channelId,
        user: metadata.userId,
        text: `✅ Your leave dates have been updated successfully!\n\n*Updated Details:*\n• Type: ${originalLeave.leaveType.charAt(0).toUpperCase() + originalLeave.leaveType.slice(1)}\n• Date: ${startDateStr} - ${endDateStr}\n• Duration: ${originalLeave.isFullDay ? 'Full Day' : 'Partial Day'}\n• Times: ${originalLeave.startTime} - ${originalLeave.endTime}\n• Reason: ${originalLeave.reason || 'None'}\n\nYour updated leave will be included in the daily reminder at 9 AM.`
      });
      
    } catch (error) {
      console.error('❌ Error processing edit leave request:', error);
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
            text: '❌ Sorry, there was an error updating your leave. Please try again.'
          });
        }
      } catch (metadataError) {
        console.error('❌ Error sending error message:', metadataError);
      }
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
        text: 'ℹ️ This modal is for viewing leave details only. Use the "Edit Leave" or "Delete Leave" buttons to make changes.'
      });
      
    } catch (error) {
      console.error('❌ Error in manage leave modal submission:', error);
    }
  });

}; 