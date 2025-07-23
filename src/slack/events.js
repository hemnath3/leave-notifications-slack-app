module.exports = (app) => {
  // Handle app mention
  app.event('app_mention', async ({ event, say }) => {
    try {
      const text = event.text.toLowerCase();
      
      if (text.includes('help') || text.includes('commands')) {
        await say({
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: '*Leave Notifications Bot Commands* 📋\n\nHere are the available commands:'
              }
            },
            {
              type: 'section',
              fields: [
                {
                  type: 'mrkdwn',
                  text: '*`/notify-leave`*\nOpen the leave request form'
                },
                {
                  type: 'mrkdwn',
                  text: '*`/leaves-today`*\nView today\'s leave schedule'
                }
              ]
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: '*Features:*\n• 🏖️ Vacation, wellness, sick, personal, and other leave types\n• 📅 Full day and partial day options\n• ⏰ Time selection for partial days\n• ✅ Approval/rejection workflow\n• 📊 Daily morning summaries'
              }
            }
          ]
        });
      } else if (text.includes('status') || text.includes('summary')) {
        await say('Use `/leaves-today` to see today\'s leave schedule! 📅');
      } else {
        await say('Hi! I\'m the Leave Notifications bot. Type `help` to see available commands or use `/notify-leave` to submit a leave request! 🎉');
      }
    } catch (error) {
      console.error('Error handling app mention:', error);
    }
  });
  
  // Handle team join event (welcome new users)
  app.event('team_join', async ({ event, client }) => {
    try {
      // Send welcome message to default channel
      const defaultChannel = process.env.DEFAULT_CHANNEL_ID;
      if (defaultChannel) {
        await client.chat.postMessage({
          channel: defaultChannel,
          text: `Welcome <@${event.user.id}> to the team! 🎉\n\nYou can use the Leave Notifications bot to submit leave requests. Type \`/notify-leave\` to get started!`
        });
      }
    } catch (error) {
      console.error('Error handling team join:', error);
    }
  });
  
  // Handle channel join event
  app.event('member_joined_channel', async ({ event, client }) => {
    try {
      await client.chat.postMessage({
        channel: event.channel,
        text: `Welcome to the channel! 🎉\n\nYou can use the Leave Notifications bot here. Type \`/notify-leave\` to submit a leave request or \`/leaves-today\` to see today's schedule.`
      });
    } catch (error) {
      console.error('Error handling channel join:', error);
    }
  });
}; 