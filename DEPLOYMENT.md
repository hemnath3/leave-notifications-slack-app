# Leave Notifications Slack App - Deployment Guide

## 🚀 Production Deployment

This guide will help you deploy the Leave Notifications Slack App to your organization's Slack workspace.

## 📋 Prerequisites

1. **Slack App Setup** - Create a new Slack app in your organization
2. **MongoDB Database** - Set up a MongoDB instance (Atlas, Railway, etc.)
3. **Hosting Platform** - Deploy to Railway, Heroku, AWS, etc.

## 🔧 Slack App Configuration

### 1. Create Slack App
1. Go to [api.slack.com/apps](https://api.slack.com/apps)
2. Click "Create New App" → "From scratch"
3. Name: `Leave Notifications` (or your preferred name)
4. Select your workspace

### 2. Configure OAuth & Permissions
Go to **OAuth & Permissions** and add these scopes:

**Bot Token Scopes:**
- `chat:write` - Send messages
- `commands` - Add slash commands
- `users:read` - Read user info
- `channels:read` - Read channel info
- `app_mentions:read` - Respond to mentions

### 3. Install App to Workspace
1. Go to **Install App** section
2. Click "Install to Workspace"
3. Copy the **Bot User OAuth Token** (starts with `xoxb-`)

### 4. Configure Slash Commands
Go to **Slash Commands** and create these commands:

| Command | Request URL | Short Description |
|---------|-------------|-------------------|
| `/request-leave` | `https://your-domain.com/slack/events` | Request time off |
| `/my-leaves` | `https://your-domain.com/slack/events` | View your leaves |
| `/send-reminder` | `https://your-domain.com/slack/events` | Send daily reminder |
| `/leaves-today` | `https://your-domain.com/slack/events` | View today's leaves |

### 5. Configure Event Subscriptions
1. Go to **Event Subscriptions**
2. Enable Events: **ON**
3. Request URL: `https://your-domain.com/slack/events`
4. Subscribe to bot events:
   - `app_mention`
   - `message.im`

### 6. Get App Credentials
Copy these values:
- **Bot User OAuth Token**: `xoxb-...`
- **Signing Secret**: From **Basic Information** → **App Credentials**

## 🌍 Environment Variables

Set these environment variables in your hosting platform:

```bash
# Slack Configuration
SLACK_BOT_TOKEN=xoxb-your-bot-token-here
SLACK_SIGNING_SECRET=your-signing-secret-here

# MongoDB Configuration
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/leave-notifications

# Server Configuration
PORT=3000
NODE_ENV=production
USE_SOCKET_MODE=false

# Optional: Customize notification channel
NOTIFICATION_CHANNEL=#leave-notifications
```

## 🚀 Deployment Options

### Option 1: Railway (Recommended)
1. Connect your GitHub repository to Railway
2. Set environment variables in Railway dashboard
3. Deploy automatically on git push

### Option 2: Heroku
1. Create Heroku app
2. Set environment variables: `heroku config:set KEY=value`
3. Deploy: `git push heroku main`

### Option 3: AWS/DigitalOcean
1. Set up server/container
2. Configure environment variables
3. Use PM2 or Docker for process management

## 🔄 Development vs Production

### Development (Local)
```bash
NODE_ENV=development
USE_SOCKET_MODE=true
SLACK_APP_TOKEN=xapp-your-app-token
```

### Production
```bash
NODE_ENV=production
USE_SOCKET_MODE=false
# No SLACK_APP_TOKEN needed
```

## 📡 Webhook URL Configuration

For production, your Slack app needs to send events to:
```
https://your-domain.com/slack/events
```

Make sure your domain is accessible and has SSL (HTTPS).

## 🔍 Health Check

Test your deployment:
```bash
curl https://your-domain.com/health
```

Expected response:
```json
{
  "status": "OK",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "mode": "webhook",
  "environment": "production"
}
```

## 🛠️ Troubleshooting

### Common Issues:

1. **"URL verification failed"**
   - Check your webhook URL is accessible
   - Ensure HTTPS is enabled
   - Verify signing secret is correct

2. **"Bot token is invalid"**
   - Reinstall the app to workspace
   - Check OAuth scopes are correct

3. **"MongoDB connection failed"**
   - Verify MONGODB_URI is correct
   - Check network access to MongoDB

4. **Commands not working**
   - Verify Request URLs in slash commands
   - Check bot is added to channels
   - Ensure proper scopes are granted

## 📊 Monitoring

Monitor your app with:
- **Health endpoint**: `/health`
- **Logs**: Check hosting platform logs
- **Slack app analytics**: api.slack.com/apps → Your App → Analytics

## 🔐 Security Best Practices

1. **Environment Variables**: Never commit secrets to git
2. **HTTPS**: Always use HTTPS in production
3. **Rate Limiting**: Already configured in the app
4. **Input Validation**: All user inputs are validated
5. **Database Security**: Use MongoDB Atlas or secure MongoDB instance

## 📝 Post-Deployment Checklist

- [ ] App installed to workspace
- [ ] All slash commands working
- [ ] Daily reminders being sent
- [ ] Health endpoint responding
- [ ] MongoDB connected
- [ ] Environment variables set
- [ ] HTTPS enabled
- [ ] Webhook URL verified

## 🆘 Support

If you encounter issues:
1. Check the logs in your hosting platform
2. Verify all environment variables are set
3. Test the health endpoint
4. Check Slack app configuration
5. Ensure MongoDB is accessible 