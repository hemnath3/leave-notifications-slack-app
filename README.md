# Leave Notifications Slack App

A comprehensive Slack application for managing leave requests with modal forms and automated daily notifications.

## Features

- 🏖️ **Multiple Leave Types**: Vacation, wellness, sick, personal, and other
- 📅 **Flexible Scheduling**: Full day and partial day options with time selection
- 📊 **Daily Notifications**: Automated morning summaries sent to channels
- 🔍 **Overlap Detection**: Prevents duplicate leave requests
- 📱 **Slack Commands**: Easy-to-use slash commands
- 🗄️ **Database Storage**: MongoDB backend for data persistence
- 🔒 **Channel Notifications**: Notify multiple channels about leaves

## Prerequisites

- Node.js (v16 or higher)
- MongoDB (local or cloud)
- Slack workspace (trial account for testing)

## Installation

### Option 1: Local Development

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd Leave_Notifications
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp env.example .env
   ```
   
   Edit `.env` with your configuration:
   ```env
   # Slack App Configuration
   SLACK_BOT_TOKEN=xoxb-your-bot-token
   SLACK_SIGNING_SECRET=your-signing-secret
   SLACK_APP_TOKEN=xapp-your-app-token
   
   # MongoDB Configuration
   MONGODB_URI=mongodb://localhost:27017/leave-notifications
   
   # Server Configuration
   PORT=3000
   NODE_ENV=development
   ```

4. **Start the application**
   ```bash
   # Development mode
   npm run dev
   
   # Production mode
   npm start
   ```

### Option 2: Docker Deployment

1. **Build the Docker image**
   ```bash
   docker build -t leave-notifications-app .
   ```

2. **Run with environment variables**
   ```bash
   docker run -d \
     --name leave-notifications \
     -p 3000:3000 \
     -e SLACK_BOT_TOKEN=xoxb-your-bot-token \
     -e SLACK_SIGNING_SECRET=your-signing-secret \
     -e SLACK_APP_TOKEN=xapp-your-app-token \
     -e MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/leave-notifications \
     -e NODE_ENV=production \
     leave-notifications-app
   ```

### Option 3: Railway Deployment

1. **Connect your GitHub repository to Railway**
2. **Set environment variables in Railway dashboard:**
   - `SLACK_BOT_TOKEN`
   - `SLACK_SIGNING_SECRET`
   - `SLACK_APP_TOKEN`
   - `MONGODB_URI`
   - `NODE_ENV=production`
3. **Deploy automatically on push to main branch**

## Slack App Setup

### 1. Create a Slack App

1. Go to [api.slack.com/apps](https://api.slack.com/apps)
2. Click "Create New App" → "From scratch"
3. Name your app (e.g., "Leave Notifications")
4. Select your workspace

### 2. Configure App Settings

#### Basic Information
- Add app icon and description
- Note your **Signing Secret** (add to `.env`)

#### OAuth & Permissions
Add these bot token scopes:
- `chat:write` - Send messages
- `commands` - Add slash commands
- `users:read` - Read user information
- `channels:read` - Read channel information
- `app_mentions:read` - Read app mentions

#### Slash Commands
Add these commands:
- `/leaves` - Open leave request form
- `/leaves-today` - View leaves with filtering options
  - `/leaves-today` - All leaves today
  - `/leaves-today hemnath` - Hemnath's leaves today
  - `/leaves-today 23/07/2025` - All leaves on 23rd July
  - `/leaves-today hemnath 23/07/2025` - Hemnath's leaves on 23rd July

#### Event Subscriptions
Enable events and subscribe to:
- `app_mention` - When someone mentions the app
- `team_join` - When someone joins the workspace
- `member_joined_channel` - When someone joins a channel

#### Interactivity & Shortcuts
- Enable interactivity
- Set request URL to: `https://your-domain.com/slack/events`

### 3. Install App to Workspace

1. Go to "Install App" in the sidebar
2. Click "Install to Workspace"
3. Copy the **Bot User OAuth Token** (starts with `xoxb-`)
4. Add to your `.env` file

### 4. Enable Socket Mode (for development)

1. Go to "Basic Information" → "App-Level Tokens"
2. Generate a new token with `connections:write` scope
3. Copy the token (starts with `xapp-`)
4. Add to your `.env` file

## Usage

### For Users

#### Submit a Leave Request
1. Type `/leaves` in any channel
2. Fill out the modal form:
   - Select leave type (vacation, wellness, sick, etc.)
   - Choose full day or partial day
   - Set start and end dates
   - Add time for partial days
   - Provide a reason
3. Click "Submit"

#### View Today's Leaves
- Type `/leaves-today` to see who's on leave today

#### Get Help
- Mention the bot with "help" to see available commands

### For Managers

#### Approve/Reject Requests
- When a leave request is submitted, you'll see Approve/Reject buttons
- Click to approve or reject the request
- The user will be notified of the decision

#### Daily Notifications
- Every morning at 8:00 AM, the bot sends a summary of who's on leave
- Includes leave type, duration, and approval status

#### Weekly Reports
- Every Monday at 9:00 AM, the bot sends a weekly summary
- Shows all leaves scheduled for the week

## API Endpoints

### Leave Management
- `GET /api/leaves/channel/:channelId` - Get all leaves for a channel
- `GET /api/leaves/today/:channelId` - Get today's leaves
- `GET /api/leaves/user/:userId` - Get leaves for a specific user
- `POST /api/leaves` - Create a new leave request
- `PATCH /api/leaves/:id/status` - Update leave status
- `DELETE /api/leaves/:id` - Delete a leave request

### Statistics
- `GET /api/leaves/stats/:channelId` - Get leave statistics

## Development

### Project Structure
```
src/
├── models/
│   └── Leave.js          # MongoDB schema
├── routes/
│   └── leave.js          # API routes
├── slack/
│   ├── commands.js       # Slash command handlers
│   ├── actions.js        # Modal and button handlers
│   └── events.js         # Event handlers
├── services/
│   └── scheduler.js      # Daily notification scheduler
└── server.js             # Main application file
```

### Running Tests
```bash
npm test
```

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `SLACK_BOT_TOKEN` | Bot user OAuth token | Yes |
| `SLACK_SIGNING_SECRET` | App signing secret | Yes |
| `SLACK_APP_TOKEN` | App-level token for socket mode | Yes |
| `MONGODB_URI` | MongoDB connection string | Yes |
| `PORT` | Server port | No (default: 3000) |
| `DEFAULT_CHANNEL_ID` | Default channel for notifications | No |

## Deployment

### Local Development
```bash
npm run dev
```

### Production Deployment

1. **Set up MongoDB**
   - Use MongoDB Atlas or self-hosted MongoDB
   - Update `MONGODB_URI` in environment variables

2. **Deploy to Cloud Platform**
   - Heroku, Railway, or any Node.js hosting platform
   - Set environment variables in your hosting platform
   - Update Slack app URLs to your production domain

3. **SSL Certificate**
   - Required for Slack webhooks
   - Use Let's Encrypt or your hosting provider's SSL

### Environment Variables for Production
```env
NODE_ENV=production
SLACK_BOT_TOKEN=xoxb-production-token
SLACK_SIGNING_SECRET=your-production-secret
SLACK_APP_TOKEN=xapp-production-token
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/leave-notifications
```

## Troubleshooting

### Common Issues

1. **"Invalid token" error**
   - Check that your bot token is correct
   - Ensure the app is installed to your workspace

2. **"Invalid signing secret" error**
   - Verify your signing secret in the Slack app settings
   - Check that it matches your `.env` file

3. **Modal not opening**
   - Ensure the bot has `commands` scope
   - Check that the slash command is properly configured

4. **Database connection issues**
   - Verify MongoDB is running
   - Check your connection string
   - Ensure network access to MongoDB

### Debug Mode
Set `NODE_ENV=development` to enable detailed logging.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions:
1. Check the troubleshooting section
2. Review Slack API documentation
3. Open an issue on GitHub

---

**Note**: This app is designed for testing with a trial Slack workspace. For production use in an organization, ensure compliance with your organization's policies and data handling requirements. 