# OAuth Scopes Required for Leave Notifications App

## Current Scopes
The app currently uses these OAuth scopes:

- `chat:write` - Send messages to channels
- `commands` - Add slash commands
- `users:read` - Read user information
- `channels:read` - Read public channel information
- `app_mentions:read` - Respond to app mentions

## Additional Scopes Needed for Better Channel Detection

To implement the improved channel detection system, add these scopes:

### Required Scopes:
- `groups:read` - **NEW** - Read private channel information
- `channels:read` - Already have this
- `users:read` - Already have this

### Optional Scopes (for future features):
- `users:read.email` - Read user email addresses
- `channels:history` - Read channel message history (for future features)

## How to Add Scopes

1. **Go to your Slack App settings** at https://api.slack.com/apps
2. **Select your app**
3. **Go to "OAuth & Permissions"**
4. **Add the new scopes** to the "Bot Token Scopes" section
5. **Reinstall the app** to your workspace to apply the new permissions

## What This Enables

With `groups:read` scope, the app can:

- **Access private channels** where the app is installed
- **Get accurate channel names** for private channels
- **Properly filter channels** that user is in AND app is installed
- **Show real channel names** instead of "Private Channel"

## Implementation Details

The improved system uses:

1. **`users.conversations`** - Get all channels user is a member of
2. **`conversations.list`** - Get all channels app has access to
3. **Intersection** - Find channels that are both user-accessible and app-installed
4. **Accurate names** - Get real channel names for both public and private channels

## Security Note

- `groups:read` only allows reading channel information
- The app cannot read messages in private channels without additional scopes
- User privacy is maintained - app only sees channels where it's installed 