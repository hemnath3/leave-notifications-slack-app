# Quick Start Guide

Get your Leave Notifications Slack app running in 5 minutes!

## 🚀 Quick Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Up Environment
```bash
cp env.example .env
```

### 3. Create a Slack App (5 minutes)

1. **Go to [api.slack.com/apps](https://api.slack.com/apps)**
2. **Click "Create New App" → "From scratch"**
3. **Name it "Leave Notifications" and select your workspace**

#### Configure Basic Settings:
- **Basic Information**: Copy the "Signing Secret" to your `.env` file
- **OAuth & Permissions**: Add these scopes:
  - `chat:write`
  - `commands`
  - `users:read`
  - `channels:read`
  - `app_mentions:read`

#### Add Slash Commands:
- `/leaves` → `Open leave request form`
- `/leaves-today` → `View leaves with filtering options`

#### Enable Events:
- Subscribe to: `app_mention`, `team_join`, `member_joined_channel`

#### Install App:
- Go to "Install App" → "Install to Workspace"
- Copy the "Bot User OAuth Token" (starts with `xoxb-`) to your `.env`

#### Enable Socket Mode:
- Go to "Basic Information" → "App-Level Tokens"
- Generate token with `connections:write` scope
- Copy token (starts with `xapp-`) to your `.env`

### 4. Set Up MongoDB

**Option A: Local MongoDB**
```bash
# Install MongoDB locally
brew install mongodb-community  # macOS
# or download from mongodb.com

# Start MongoDB
mongod
```

**Option B: MongoDB Atlas (Recommended)**
1. Go to [mongodb.com/atlas](https://mongodb.com/atlas)
2. Create free cluster
3. Get connection string
4. Add to `.env` file

### 5. Update Environment Variables

Edit your `.env` file:
```env
SLACK_BOT_TOKEN=xoxb-your-bot-token-here
SLACK_SIGNING_SECRET=your-signing-secret-here
SLACK_APP_TOKEN=xapp-your-app-token-here
MONGODB_URI=mongodb://localhost:27017/leave-notifications
# or: MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/leave-notifications
PORT=3000
NODE_ENV=development
DEFAULT_CHANNEL_ID=C1234567890  # Your channel ID
```

### 6. Start the App
```bash
npm run dev
```

You should see:
```
Connected to MongoDB
Express server running on port 3000
⚡️ Slack app is running!
Notification scheduler started
```

## 🧪 Test Your App

### 1. In Slack:
- Type `/leaves` in any channel
- Fill out the form and submit
- Try `/leaves-today` to see today's leaves

### 2. Web Dashboard:
- Open `http://localhost:3000` in your browser
- Enter your channel ID and click "Load Leaves"

### 3. API Testing:
```bash
# Get today's leaves
curl http://localhost:3000/api/leaves/today/C1234567890

# Get leave statistics
curl http://localhost:3000/api/leaves/stats/C1234567890
```

## 🔧 Troubleshooting

### Common Issues:

**"Invalid token" error:**
- Check your bot token starts with `xoxb-`
- Ensure app is installed to workspace

**"Invalid signing secret" error:**
- Copy signing secret from Slack app settings
- Check for extra spaces in `.env` file

**Modal not opening:**
- Verify bot has `commands` scope
- Check slash command configuration

**Database connection failed:**
- Ensure MongoDB is running
- Check connection string format
- For Atlas: whitelist your IP address

### Debug Mode:
```bash
NODE_ENV=development npm run dev
```

## 📱 Features to Test

1. **Submit Leave Request** (`/leaves`)
   - Try different leave types
   - Test full day vs partial day
   - Submit overlapping dates (should be blocked)

2. **View Today's Leaves** (`/leaves-today`)
   - See who's on leave today

3. **Approval Workflow**
   - Submit a leave request
   - Click Approve/Reject buttons
   - Check status updates

4. **Daily Notifications**
   - Wait for 8:00 AM UTC (or modify scheduler time)
   - Check channel for morning summary

5. **Web Dashboard**
   - View all leaves
   - Filter by date range and status
   - See statistics

## 🚀 Next Steps

1. **Customize the app** for your organization
2. **Deploy to production** (Heroku, Railway, etc.)
3. **Add more features** (calendar integration, email notifications)
4. **Set up monitoring** and logging

## 📞 Need Help?

- Check the full [README.md](README.md) for detailed instructions
- Review [Slack API documentation](https://api.slack.com/)
- Open an issue on GitHub

---

**Happy coding! 🎉** 