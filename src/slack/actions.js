const Leave = require('../models/Leave');
const DateUtils = require('../utils/dateUtils');

module.exports = (app) => {
  // Handle modal submission
  app.view('leave_request_modal', async ({ ack, view, client, body }) => {
    console.log('🔍 Modal submission handler called');
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
          text: `❌ Error: Start date (${DateUtils.formatDateForDisplay(start)}) cannot be in the past. Today is ${DateUtils.formatDateForDisplay(startOfToday.toDate())}. Please select today or a future date.`
        });
        return;
      }
      
      // Validate: End date cannot be before start date
      if (end < start) {
        await client.chat.postEphemeral({
          channel: metadata.channelId,
          user: metadata.userId,
          text: `❌ Error: End date (${DateUtils.formatDateForDisplay(end)}) cannot be before start date (${DateUtils.formatDateForDisplay(start)}). Please select a date on or after the start date.`
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
  

}; 