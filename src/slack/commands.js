const Leave = require('../models/Leave');
const TeamService = require('../services/TeamService');
const DateUtils = require('../utils/dateUtils');

module.exports = (app) => {
  // Command to open leave request modal
  app.command('/notify-leave', async ({ command, ack, client, body }) => {
  console.log('🔍 /notify-leave command received:', { 
      user_id: command.user_id, 
      channel_id: command.channel_id,
      text: command.text 
    });
    await ack();
    
    try {
      // Get user info
      const userInfo = await client.users.info({
        user: command.user_id
      });
      
      // Get channel info (optional - for public channels only)
      let channelInfo = null;
      try {
        channelInfo = await client.conversations.info({
          channel: command.channel_id
        });
      } catch (channelError) {
        // Channel might be private or not accessible - that's okay
        console.log('⚠️ Could not get channel info, but continuing with modal...');
      }
      
      // Auto-add user to team when they open the modal
      await TeamService.autoAddUserToTeam(command.channel_id, channelInfo?.channel?.name || 'Unknown Channel', {
        userId: command.user_id,
        userName: userInfo.user.real_name || userInfo.user.name,
        userEmail: userInfo.user.profile?.email || ''
      });
      
      // Get all channels where user is a member and app is installed
      const userChannels = await TeamService.getUserChannelsWithApp(command.user_id, client);
      
      console.log(`🔍 User channels found: ${userChannels.length}`, 
        userChannels.map(c => `#${c.channelName}`));
      
      // If only one channel found, add a note about progressive discovery
      if (userChannels.length === 1) {
        console.log('💡 Note: Only one channel found. User may need to use the command in other channels first to be added to those teams.');
      }
      
      // If no channels found, add current channel as fallback
      if (userChannels.length === 0) {
        console.log('⚠️ No channels found, adding current channel as fallback');
        
        // Try to get current channel info
        let currentChannelName = 'Unknown Channel';
        try {
          const currentChannelInfo = await client.conversations.info({
            channel: command.channel_id
          });
          currentChannelName = currentChannelInfo.channel.name;
        } catch (error) {
          console.log('⚠️ Could not get current channel info:', error.message);
        }
        
        userChannels.push({
          channelId: command.channel_id,
          channelName: currentChannelName,
          isPrivate: false
        });
      }
      
      // Get today's date for the modal in AEST
      const today = DateUtils.getTodayString();
      
      // Open modal
      await client.views.open({
        trigger_id: body.trigger_id,
        view: {
          type: 'modal',
          callback_id: 'leave_request_modal',
          title: {
            type: 'plain_text',
            text: 'Request Leave',
            emoji: true
          },
          submit: {
            type: 'plain_text',
            text: 'Submit',
            emoji: true
          },
          close: {
            type: 'plain_text',
            text: 'Cancel',
            emoji: true
          },
          blocks: [
            {
              type: 'context',
              elements: [
                {
                  type: 'mrkdwn',
                  text: '📋 *Leave Request Guidelines:*\n• Start date: Today or future (max 3 months)\n• End date: On or after start date (max 3 months)\n• Reason required only for "Other" leave type\n• Only "Other" can be partial day'
                }
              ]
            },
            {
              type: 'context',
              elements: [
                {
                  type: 'mrkdwn',
                  text: '📢 *Channel Selection:* Use the dropdowns to select up to 3 channels to notify about your leave. # for public channels, 🔒 for private channels. Current channel is pre-selected.'
                }
              ]
            },
            {
              type: 'divider'
            },
            {
              type: 'input',
              block_id: 'leave_type',
              label: {
                type: 'plain_text',
                text: 'Leave Type',
                emoji: true
              },
              element: {
                type: 'static_select',
                placeholder: {
                  type: 'plain_text',
                  text: 'Select leave type',
                  emoji: true
                },
                options: [
                  {
                    text: {
                      type: 'plain_text',
                      text: '🏖️ Vacation',
                      emoji: true
                    },
                    value: 'vacation'
                  },
                  {
                    text: {
                      type: 'plain_text',
                      text: '🧘 Wellness Day',
                      emoji: true
                    },
                    value: 'wellness'
                  },
                  {
                    text: {
                      type: 'plain_text',
                      text: '🤒 Sick Leave',
                      emoji: true
                    },
                    value: 'sick'
                  },
                  {
                    text: {
                      type: 'plain_text',
                      text: '👤 Personal',
                      emoji: true
                    },
                    value: 'personal'
                  },
                  {
                    text: {
                      type: 'plain_text',
                      text: '📝 Other',
                      emoji: true
                    },
                    value: 'other'
                  }
                ]
              }
            },
            {
              type: 'input',
              block_id: 'is_full_day',
              label: {
                type: 'plain_text',
                text: 'Duration',
                emoji: true
              },
              element: {
                type: 'radio_buttons',
                options: [
                  {
                    text: {
                      type: 'plain_text',
                      text: 'Full Day',
                      emoji: true
                    },
                    value: 'true'
                  },
                  {
                    text: {
                      type: 'plain_text',
                      text: 'Partial Day (Only for Other leave type)',
                      emoji: true
                    },
                    value: 'false'
                  }
                ],
                initial_option: {
                  text: {
                    type: 'plain_text',
                    text: 'Full Day',
                    emoji: true
                  },
                  value: 'true'
                }
              }
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
                initial_date: today
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
                initial_date: today
              },
              hint: {
                type: 'plain_text',
                text: '📅 Select a date on or after start date (max 3 months ahead)',
                emoji: true
              }
            },
            {
              type: 'input',
              block_id: 'start_time',
              label: {
                type: 'plain_text',
                text: 'Start Time (for partial day)',
                emoji: true
              },
              element: {
                type: 'timepicker',
                placeholder: {
                  type: 'plain_text',
                  text: 'Select time',
                  emoji: true
                },
                initial_time: '09:00'
              },
              optional: true
            },
            {
              type: 'input',
              block_id: 'end_time',
              label: {
                type: 'plain_text',
                text: 'End Time (for partial day)',
                emoji: true
              },
              element: {
                type: 'timepicker',
                placeholder: {
                  type: 'plain_text',
                  text: 'Select time',
                  emoji: true
                },
                initial_time: '17:00'
              },
              optional: true
            },
            {
              type: 'input',
              block_id: 'reason',
              label: {
                type: 'plain_text',
                text: 'Reason (Required for Other leave type)',
                emoji: true
              },
              element: {
                type: 'plain_text_input',
                multiline: true,
                placeholder: {
                  type: 'plain_text',
                  text: 'Please provide a reason for your leave...',
                  emoji: true
                },
                max_length: 500
              },
              optional: true
            },
            {
              type: 'input',
              block_id: 'channel_1',
              label: {
                type: 'plain_text',
                text: 'Channel 1 (Current channel pre-selected)',
                emoji: true
              },
              element: {
                type: 'static_select',
                placeholder: {
                  type: 'plain_text',
                  text: 'Select a channel',
                  emoji: true
                },
                options: userChannels.map((channel) => ({
                  text: {
                    type: 'plain_text',
                    text: `${channel.isPrivate ? '🔒' : '#'}${channel.channelName}`,
                    emoji: true
                  },
                  value: channel.channelId
                })),
                initial_option: userChannels.find(ch => ch.channelId === command.channel_id) ? {
                  text: {
                    type: 'plain_text',
                    text: `${userChannels.find(ch => ch.channelId === command.channel_id).isPrivate ? '🔒' : '#'}${userChannels.find(ch => ch.channelId === command.channel_id).channelName}`,
                    emoji: true
                  },
                  value: command.channel_id
                } : undefined
              },
              optional: true
            },
            {
              type: 'input',
              block_id: 'channel_2',
              label: {
                type: 'plain_text',
                text: 'Channel 2 (Optional)',
                emoji: true
              },
              element: {
                type: 'static_select',
                placeholder: {
                  type: 'plain_text',
                  text: 'Select a channel',
                  emoji: true
                },
                options: [
                  {
                    text: {
                      type: 'plain_text',
                      text: 'None',
                      emoji: true
                    },
                    value: 'none'
                  },
                  ...userChannels.map((channel) => ({
                    text: {
                      type: 'plain_text',
                      text: `${channel.isPrivate ? '🔒' : '#'}${channel.channelName}`,
                      emoji: true
                    },
                    value: channel.channelId
                  }))
                ],
                initial_option: {
                  text: {
                    type: 'plain_text',
                    text: 'None',
                    emoji: true
                  },
                  value: 'none'
                }
              },
              optional: true
            },
            {
              type: 'input',
              block_id: 'channel_3',
              label: {
                type: 'plain_text',
                text: 'Channel 3 (Optional)',
                emoji: true
              },
              element: {
                type: 'static_select',
                placeholder: {
                  type: 'plain_text',
                  text: 'Select a channel',
                  emoji: true
                },
                options: [
                  {
                    text: {
                      type: 'plain_text',
                      text: 'None',
                      emoji: true
                    },
                    value: 'none'
                  },
                  ...userChannels.map((channel) => ({
                    text: {
                      type: 'plain_text',
                      text: `${channel.isPrivate ? '🔒' : '#'}${channel.channelName}`,
                      emoji: true
                    },
                    value: channel.channelId
                  }))
                ],
                initial_option: {
                  text: {
                    type: 'plain_text',
                    text: 'None',
                    emoji: true
                  },
                  value: 'none'
                }
              },
              optional: true
            }
          ],
          private_metadata: JSON.stringify({
            userId: command.user_id,
            userName: userInfo.user.real_name || userInfo.user.name,
            userEmail: userInfo.user.profile?.email || '',
            channelId: command.channel_id,
            channelName: channelInfo?.channel?.name || 'Unknown Channel'
          }),
          validate: async (payload) => {
            console.log('🔍 Modal validation triggered');
            const values = payload.state.values;
            console.log('📋 Full payload values:', JSON.stringify(values, null, 2));
            
            const errors = {};
            
            // Extract values using dynamic key lookup
            const startDateKey = Object.keys(values.start_date || {})[0];
            const endDateKey = Object.keys(values.end_date || {})[0];
            const leaveTypeKey = Object.keys(values.leave_type || {})[0];
            const isFullDayKey = Object.keys(values.is_full_day || {})[0];
            const reasonKey = Object.keys(values.reason || {})[0];
            
            const startDate = startDateKey ? values.start_date[startDateKey].selected_date : null;
            const endDate = endDateKey ? values.end_date[endDateKey].selected_date : null;
            const leaveType = leaveTypeKey ? values.leave_type[leaveTypeKey].selected_option?.value : null;
            const isFullDay = isFullDayKey ? values.is_full_day[isFullDayKey].selected_option?.value === 'true' : true;
            const reason = reasonKey ? values.reason[reasonKey].value || '' : '';
            
            console.log('📅 Validation data:', { startDate, endDate, leaveType, isFullDay, reason });
            
            // Validate start date is not in the past
            if (startDate) {
              const startDateObj = new Date(startDate + 'T00:00:00');
              const todayObj = new Date(today + 'T00:00:00');
              
              console.log('📅 Start date comparison:', { 
                startDateObj: startDateObj.toISOString(), 
                todayObj: todayObj.toISOString(),
                isPast: startDateObj < todayObj 
              });
              
              if (startDateObj < todayObj) {
                console.log('❌ Start date validation failed');
                errors[startDateKey] = 'Start date cannot be in the past. Please select today or a future date.';
              }
            }
            
            // Validate end date is not before start date
            if (startDate && endDate) {
              const startDateObj = new Date(startDate + 'T00:00:00');
              const endDateObj = new Date(endDate + 'T00:00:00');
              
              console.log('📅 End date comparison:', { 
                startDateObj: startDateObj.toISOString(), 
                endDateObj: endDateObj.toISOString(),
                isInvalid: endDateObj < startDateObj 
              });
              
              if (endDateObj < startDateObj) {
                console.log('❌ End date validation failed');
                errors[endDateKey] = 'End date cannot be before start date. Please select a date on or after the start date.';
              }
            }
            
            // Validate dates are not more than 3 months in the future
            if (startDate) {
              const startDateObj = new Date(startDate + 'T00:00:00');
              const threeMonthsFromNow = new Date();
              threeMonthsFromNow.setMonth(threeMonthsFromNow.getMonth() + 3);
              threeMonthsFromNow.setHours(0, 0, 0, 0);
              
              console.log('📅 3-month validation:', { 
                startDateObj: startDateObj.toISOString(), 
                threeMonthsFromNow: threeMonthsFromNow.toISOString(),
                isTooFar: startDateObj > threeMonthsFromNow 
              });
              
              if (startDateObj > threeMonthsFromNow) {
                console.log('❌ 3-month validation failed for start date');
                errors[startDateKey] = 'Cannot apply leave more than 3 months in advance. Please select a date within the next 3 months.';
              }
            }
            
            if (endDate) {
              const endDateObj = new Date(endDate + 'T00:00:00');
              const threeMonthsFromNow = new Date();
              threeMonthsFromNow.setMonth(threeMonthsFromNow.getMonth() + 3);
              threeMonthsFromNow.setHours(0, 0, 0, 0);
              
              console.log('📅 3-month validation for end date:', { 
                endDateObj: endDateObj.toISOString(), 
                threeMonthsFromNow: threeMonthsFromNow.toISOString(),
                isTooFar: endDateObj > threeMonthsFromNow 
              });
              
              if (endDateObj > threeMonthsFromNow) {
                console.log('❌ 3-month validation failed for end date');
                errors[endDateKey] = 'Cannot apply leave more than 3 months in advance. Please select a date within the next 3 months.';
              }
            }
            
            // Validate reason is required for "Other" leave type
            if (leaveType === 'other' && (!reason || reason.trim() === '')) {
              console.log('❌ Reason validation failed');
              errors[reasonKey] = 'Reason is required for "Other" leave type. Please provide a reason.';
            }
            
            // Validate only "Other" can be partial day
            if (!isFullDay && leaveType !== 'other') {
              console.log('❌ Partial day validation failed');
              errors[isFullDayKey] = 'Only "Other" leave type can be partial day. Please select "Full Day" for other leave types.';
            }
            
            if (Object.keys(errors).length > 0) {
              console.log('❌ Validation errors found:', errors);
              return {
                response_action: 'errors',
                errors: errors
              };
            }
            
            console.log('✅ Modal validation passed');
            return null; // No errors
          }
        }
      });
    } catch (error) {
      console.error('❌ Error opening leave modal:', error);
      
      let errorMessage = 'Sorry, there was an error opening the leave request form. Please try again.';
      
      // Provide more specific error messages
      if (error.code === 'slack_webapi_platform_error') {
        if (error.data.error === 'missing_scope') {
          errorMessage = 'The app needs additional permissions. Please contact your workspace admin to add the required scopes.';
        } else if (error.data.error === 'channel_not_found') {
          errorMessage = 'Channel not found. Please try using the command in a different channel.';
        }
      }
      
      try {
        await client.chat.postEphemeral({
          channel: command.channel_id,
          user: command.user_id,
          text: errorMessage
        });
      } catch (ephemeralError) {
        // If we can't send ephemeral, try sending a DM
        try {
          await client.chat.postMessage({
            channel: command.user_id,
            text: errorMessage
          });
        } catch (dmError) {
          console.error('❌ Could not send error message to user:', dmError);
        }
      }
    }
  });

  // Enhanced command to view leaves with filtering options
  app.command('/leaves-today', async ({ command, ack, client }) => {
    await ack();
    
    try {
      const args = command.text.trim().split(/\s+/);
      let targetDate = DateUtils.getCurrentDate().toDate();
      let targetUser = null;
      
      // Parse arguments
      for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        
        // Check if it's a date (DD/MM/YYYY or YYYY-MM-DD format)
        if (arg.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
          // DD/MM/YYYY format
          const [day, month, year] = arg.split('/');
          targetDate = new Date(year, month - 1, day);
        } else if (arg.match(/^\d{4}-\d{2}-\d{2}$/)) {
          // YYYY-MM-DD format
          targetDate = new Date(arg);
        } else if (arg && !targetUser) {
          // Assume it's a username
          targetUser = arg.toLowerCase();
        }
      }
      
      // Get team info and filter leaves by team members
      const team = await TeamService.getTeamByChannel(command.channel_id);
      let leaves = [];
      
      if (team) {
        // Get team member user IDs
        const teamMemberIds = team.members.map(m => m.userId);
        
        // Get leaves for the channel, but only for team members
        leaves = await Leave.find({ 
          channelId: command.channel_id,
          userId: { $in: teamMemberIds }
        });
      } else {
        // Fallback: get all leaves for the channel if no team exists
        leaves = await Leave.find({ channelId: command.channel_id });
      }
      
      // Filter by date
      const targetDateStr = targetDate.toISOString().split('T')[0];
      leaves = leaves.filter(leave => {
        const startDate = new Date(leave.startDate);
        const endDate = new Date(leave.endDate);
        const startDateStr = startDate.toISOString().split('T')[0];
        const endDateStr = endDate.toISOString().split('T')[0];
        
        // Check if the target date falls within the leave period
        return targetDateStr >= startDateStr && targetDateStr <= endDateStr;
      });
      
      // If no specific date was provided, only show today's leaves (not past leaves)
      if (!command.text.trim()) {
        const todayStr = DateUtils.getTodayString();
        leaves = leaves.filter(leave => {
          const startDate = new Date(leave.startDate);
          const endDate = new Date(leave.endDate);
          const startDateStr = startDate.toISOString().split('T')[0];
          const endDateStr = endDate.toISOString().split('T')[0];
          
          // Show leaves that either start today or are ongoing today
          return startDateStr <= todayStr && endDateStr >= todayStr;
        });
      } else {
        // If a specific date was provided, check if it's within 30 days in the past
        const targetDateObj = new Date(targetDate);
        if (!DateUtils.isWithinThirtyDaysPast(targetDateObj)) {
          await client.chat.postEphemeral({
            channel: command.channel_id,
            user: command.user_id,
            text: '❌ Error: Cannot view leaves more than 30 days in the past. Please select a more recent date.'
          });
          return;
        }
      }
      
      // Filter by user if specified
      if (targetUser) {
        leaves = leaves.filter(leave => 
          leave.userName.toLowerCase().includes(targetUser) ||
          leave.userId.toLowerCase().includes(targetUser)
        );
      }
      
      // Sort by start date
      leaves.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
      
      if (leaves.length === 0) {
        const dateStr = targetDate.toLocaleDateString();
        const userStr = targetUser ? ` for ${targetUser}` : '';
        await client.chat.postEphemeral({
          channel: command.channel_id,
          user: command.user_id,
          text: `No leaves scheduled for ${dateStr}${userStr}! 🎉`
        });
        return;
      }
      
      const leaveBlocks = leaves.map(leave => {
        const startDate = new Date(leave.startDate).toLocaleDateString();
        const endDate = new Date(leave.endDate).toLocaleDateString();
        const duration = leave.isFullDay ? 'Full Day' : `${leave.startTime} - ${leave.endTime}`;
        const isMultiDay = startDate !== endDate;
        
        let emoji, leaveTypeText;
        switch(leave.leaveType) {
          case 'vacation':
            emoji = '🏖️';
            leaveTypeText = 'Vacationing';
            break;
          case 'wellness':
            emoji = '🧘';
            leaveTypeText = 'Wellness Day';
            break;
          case 'sick':
            emoji = '🤒';
            leaveTypeText = 'Sick Leave';
            break;
          case 'personal':
            emoji = '👤';
            leaveTypeText = 'Personal Leave';
            break;
          default:
            emoji = '📝';
            leaveTypeText = 'Other Leave';
        }
        
        return {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `${emoji} *${leave.userName}* - ${leaveTypeText}\n📅 ${startDate}${isMultiDay ? ` to ${endDate}` : ''}\n⏰ ${duration}${!leave.isFullDay ? `\n💬 ${leave.reason}` : ''}`
          }
        };
      });
      
      const dateStr = targetDate.toLocaleDateString();
      const userStr = targetUser ? ` for ${targetUser}` : '';
      const title = `📅 Leaves for ${dateStr}${userStr}`;
      
      await client.chat.postEphemeral({
        channel: command.channel_id,
        user: command.user_id,
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: title,
              emoji: true
            }
          },
          {
            type: 'divider'
          },
          ...leaveBlocks,
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `💡 *Usage:* \`/leaves-today [username] [date]\`\nExamples:\n• \`/leaves-today\` - All leaves today\n• \`/leaves-today hemnath\` - Hemnath's leaves today\n• \`/leaves-today 23/07/2025\` - All leaves on 23rd July\n• \`/leaves-today hemnath 23/07/2025\` - Hemnath's leaves on 23rd July`
              }
            ]
          }
        ]
      });
    } catch (error) {
      console.error('Error fetching leaves:', error);
      
      let errorMessage = 'Sorry, there was an error fetching the leaves.';
      
      if (error.code === 'slack_webapi_platform_error' && error.data?.error === 'not_in_channel') {
        errorMessage = '❌ I need to be invited to this channel to see leave information. Please invite me using `/invite @leave_notifications`';
      }
      
      await client.chat.postEphemeral({
        channel: command.channel_id,
        user: command.user_id,
        text: errorMessage
      });
    }
  });

  // Command to manually send daily reminder
  app.command('/send-reminder', async ({ command, ack, client }) => {
    await ack();
    
    try {
      console.log('🔍 Manual reminder requested for channel:', command.channel_id);
      
      // Get today's leaves for this specific channel
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const leaves = await Leave.find({
        channelId: command.channel_id,
        startDate: { $lte: tomorrow },
        endDate: { $gte: today }
      }).sort({ startDate: 1 });
      
      // Only show leaves that actually start today (not leaves that start tomorrow but overlap with today)
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
              text: `📅 *${DateUtils.getCurrentDate().format('dddd, MMMM Do, YYYY')}* | ⏰ *${DateUtils.getCurrentTimeString()} AEST*`
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
      const hasUpcomingLeaves = await addUpcomingLeavesSection(blocks, command.channel_id);
      if (hasUpcomingLeaves) {
        console.log('✅ Upcoming leaves section added');
      } else {
        console.log('ℹ️ No upcoming leaves found, skipping section');
      }
      

      
      try {
        await client.chat.postMessage({
          channel: command.channel_id,
          blocks: blocks
        });
      } catch (error) {
        if (error.code === 'slack_webapi_platform_error' && error.data.error === 'not_in_channel') {
          // App is not in the channel - send DM to user with instructions
          await client.chat.postMessage({
            channel: command.user_id,
            text: `❌ I can't post to <#${command.channel_id}> because I'm not a member of that channel.\n\nTo fix this:\n1. Invite me to the channel by typing: \`/invite @Leave Notifications\`\n2. Or use the command in a channel where I'm already a member\n\nYour leave data was saved successfully!`
          });
        } else {
          throw error; // Re-throw other errors
        }
      }
      
    } catch (error) {
      console.error('❌ Error sending manual reminder:', error);
      try {
        await client.chat.postMessage({
          channel: command.user_id,
          text: '❌ Sorry, there was an error sending the reminder. Please try again.'
        });
      } catch (dmError) {
        console.error('❌ Could not send error message to user:', dmError);
      }
    }
  });

  // Command to manage user's leaves (view, edit, delete)
  app.command('/my-leaves', async ({ command, ack, client }) => {
    console.log('🔍 /my-leaves command received:', { 
      user_id: command.user_id, 
      channel_id: command.channel_id,
      text: command.text 
    });
    
    try {
      await ack();
      
      console.log('🔍 My leaves requested by user:', command.user_id);
      
      // Get user's leaves (current and future)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      console.log('📅 Searching for leaves from:', today.toISOString());
      
      const userLeaves = await Leave.find({
        userId: command.user_id,
        endDate: { $gte: today }
      }).sort({ startDate: 1 }).lean();
      
      console.log('📋 Found user leaves:', userLeaves.length);
      
      if (userLeaves.length === 0) {
        console.log('📅 No leaves found for user');
        await client.chat.postEphemeral({
          channel: command.channel_id,
          user: command.user_id,
          text: '📅 You don\'t have any current or upcoming leaves scheduled.'
        });
        return;
      }
      
      const blocks = [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '📋 Your Leave Schedule',
            emoji: true
          }
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: 'Click on a leave to edit or delete it'
            }
          ]
        },
        {
          type: 'divider'
        }
      ];
      
      userLeaves.forEach((leave, index) => {
        const startDate = new Date(leave.startDate);
        const endDate = new Date(leave.endDate);
        const isMultiDay = startDate.toDateString() !== endDate.toDateString();
        
        let emoji, text;
        
        if (isMultiDay) {
          const startStr = startDate.toLocaleDateString();
          const endStr = endDate.toLocaleDateString();
          emoji = '🏖️';
          text = `*${leave.leaveType.charAt(0).toUpperCase() + leave.leaveType.slice(1)}* (${startStr} - ${endStr})`;
        } else {
          if (leave.isFullDay) {
            switch(leave.leaveType) {
              case 'vacation':
                emoji = '🏖️';
                break;
              case 'wellness':
                emoji = '🧘';
                break;
              case 'sick':
                emoji = '🤒';
                break;
              case 'personal':
                emoji = '👤';
                break;
              default:
                emoji = '📝';
            }
            text = `*${leave.leaveType.charAt(0).toUpperCase() + leave.leaveType.slice(1)}* (${startDate.toLocaleDateString()})`;
          } else {
            emoji = '⏰';
            text = `*Partial Day* (${startDate.toLocaleDateString()}, ${leave.startTime} - ${leave.endTime})`;
          }
        }
        
        if (leave.reason && leave.leaveType === 'other') {
          text += `\n> _${leave.reason}_`;
        }
        
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `${emoji} ${text}`
          },
          accessory: {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'Manage',
              emoji: true
            },
            value: leave._id.toString(),
            action_id: 'manage_leave'
          }
        });
      });
      
      await client.chat.postEphemeral({
        channel: command.channel_id,
        user: command.user_id,
        blocks: blocks
      });
      
    } catch (error) {
      console.error('❌ Error in /my-leaves command:', error);
      console.error('❌ Error details:', {
        message: error.message,
        stack: error.stack,
        command: command ? 'command exists' : 'no command'
      });
      
      try {
        await client.chat.postEphemeral({
          channel: command.channel_id,
          user: command.user_id,
          text: '❌ Sorry, there was an error fetching your leaves. Please try again.'
        });
      } catch (ephemeralError) {
        console.error('❌ Could not send error message to user:', ephemeralError);
        // Try to send a DM as fallback
        try {
          await client.chat.postMessage({
            channel: command.user_id,
            text: '❌ Sorry, there was an error fetching your leaves. Please try again.'
          });
        } catch (dmError) {
          console.error('❌ Could not send DM either:', dmError);
        }
      }
    }
  });

  // Helper function to add upcoming leaves section
  async function addUpcomingLeavesSection(blocks, channelId) {
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
              const emoji = getLeaveTypeEmoji(leave.leaveType);
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
  
  // Helper function to get leave type emoji
  function getLeaveTypeEmoji(type) {
    switch(type) {
      case 'vacation': return '🏖️';
      case 'wellness': return '🧘';
      case 'sick': return '🤒';
      case 'personal': return '👤';
      default: return '📝';
    }
  }
}; 