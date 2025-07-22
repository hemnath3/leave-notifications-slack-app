# 🚀 Slack App Channel Setup Guide

## How to Use the Leave Notifications App in Multiple Channels

### ✅ **What Works Now:**

1. **Submit Leave Forms**: You can use `/leave` in ANY channel where the app is installed
2. **Manual Reminders**: Use `/send-reminder` in any channel where the app is a member
3. **Daily Reminders**: Automatically sent to all channels where the app is a member
4. **Data Storage**: All leave data is stored centrally in MongoDB

### 🔧 **To Add the App to a New Channel:**

1. **Invite the App**: In the channel, type:
   ```
   /invite @Leave Notifications
   ```

2. **Verify Installation**: The app should now be able to:
   - Post daily reminders at 9 AM
   - Respond to `/send-reminder` commands
   - Send weekly summaries (if enabled)

### 🎯 **Smart Error Handling:**

- **If you use `/send-reminder` in a channel where the app isn't a member**: You'll get a helpful DM with instructions
- **If the app can't post to a channel**: It logs a warning but doesn't crash
- **Leave submissions always work**: Even if the app can't post confirmations, your data is saved

### 📋 **Best Practices:**

1. **Primary Channel**: Keep your main team channel as the primary one in `.env`
2. **Department Channels**: Add the app to department-specific channels for targeted reminders
3. **Project Channels**: Add to project channels for project-specific leave tracking

### 🔍 **Testing:**

1. **Test in a new channel**:
   - Invite the app: `/invite @Leave Notifications`
   - Submit a leave: `/leave`
   - Send manual reminder: `/send-reminder`

2. **Verify the app works**:
   - Should post beautiful formatted reminders
   - Should handle partial day leaves correctly
   - Should only count full-day leaves in summary

### 🛠️ **Troubleshooting:**

- **"not_in_channel" error**: Just invite the app to the channel
- **App not responding**: Check if it's online in your workspace
- **No daily reminders**: Verify the app is a member of the channel

The app is designed to work seamlessly across your entire Slack workspace! 🎉 