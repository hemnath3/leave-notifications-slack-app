# 🔧 Slack App Scope Setup Guide

## Missing Scopes Issue

If you're getting a "missing_scope" error, the app needs additional permissions to work with private channels.

### ✅ **Current Scopes (Working):**
- `chat:write` - Post messages
- `commands` - Use slash commands
- `users:read` - Read user information
- `channels:read` - Read public channel information
- `app_mentions:read` - Respond to mentions

### 🔧 **Additional Scopes Needed (Optional):**
- `groups:read` - Read private channel information
- `mpim:read` - Read multi-person DM information
- `im:read` - Read DM information

### 🚀 **How to Add Missing Scopes:**

1. **Go to your Slack App settings**: https://api.slack.com/apps
2. **Select your app**: Leave Notifications
3. **Go to "OAuth & Permissions"** in the left sidebar
4. **Add these scopes** under "Bot Token Scopes":
   - `groups:read`
   - `mpim:read` 
   - `im:read`
5. **Reinstall the app** to your workspace
6. **Restart your server**

### 🎯 **What This Fixes:**

- **Private Channels**: App can now access private channel information
- **Multi-person DMs**: App can work in group DMs
- **Better Error Handling**: More specific error messages
- **Graceful Degradation**: App works even without these scopes

### 🧪 **Testing:**

1. **Try `/leave` in a private channel**
2. **Try `/send-reminder` in a private channel**
3. **Verify the app works in all channel types**

### 📝 **Note:**

The app will work in public channels even without the additional scopes. The extra scopes are only needed for private channels and DMs.

If you can't add the scopes, the app will still work in public channels and provide helpful error messages for private channels. 