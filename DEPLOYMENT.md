# 🚀 Deployment Guide - Railway

## Quick Deploy to Railway

### Step 1: Prepare Your Repository
1. **Push your code to GitHub** (if not already done)
2. **Ensure these files are in your repo:**
   - `package.json` ✅
   - `src/server.js` ✅
   - `Procfile` ✅
   - `railway.json` ✅
   - `.gitignore` ✅

### Step 2: Deploy to Railway

#### Option A: Deploy via Railway Dashboard
1. Go to [railway.app](https://railway.app)
2. Click **"Start a New Project"**
3. Choose **"Deploy from GitHub repo"**
4. Select your repository
5. Railway will auto-detect it's a Node.js app

#### Option B: Deploy via Railway CLI
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Initialize project
railway init

# Deploy
railway up
```

### Step 3: Configure Environment Variables

In Railway Dashboard → Your Project → Variables tab, add:

```env
# Slack App Credentials
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_SIGNING_SECRET=your-signing-secret
SLACK_APP_TOKEN=xapp-your-app-token

# MongoDB
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/leave-notifications

# Optional: Channel for notifications
SLACK_CHANNEL_ID=C1234567890

# Remove this for production (only for development)
# NODE_TLS_REJECT_UNAUTHORIZED=0
```

### Step 4: Get Your App URL

1. Go to **Settings** tab in Railway
2. Copy your **Domain** (e.g., `https://your-app-name.railway.app`)
3. **You don't need this URL for Socket Mode** - your app works without it!

### Step 5: Test Your Deployment

1. **Check logs** in Railway Dashboard → Deployments
2. **Test your Slack commands:**
   - `/leave` - Should open modal
   - `/send-reminder` - Should post message
   - `/leaves-today` - Should show leaves

## 🎯 Why Railway is Perfect for Your App

### ✅ **Socket Mode Compatible**
- Your app uses Socket Mode (no public URL needed)
- Works perfectly with Railway's free tier

### ✅ **Always Running**
- Free tier: 500 hours/month
- Your app runs 24/7 without issues

### ✅ **Auto-Scaling**
- Handles traffic spikes automatically
- No manual scaling needed

### ✅ **Easy Updates**
- Push to GitHub → Auto-deploy
- Zero downtime deployments

## 🔧 Troubleshooting

### Common Issues:

#### 1. **App Not Starting**
- Check Railway logs
- Verify all environment variables are set
- Ensure MongoDB URI is correct

#### 2. **Slack Commands Not Working**
- Verify Slack tokens are correct
- Check if app is installed in your workspace
- Ensure all required scopes are added

#### 3. **MongoDB Connection Issues**
- Verify MongoDB URI format
- Check if MongoDB Atlas IP whitelist includes Railway IPs
- Or use MongoDB Atlas with `0.0.0.0/0` for all IPs

### Logs to Check:
```bash
# In Railway Dashboard → Deployments → View Logs
# Look for:
✅ "Connected to MongoDB"
✅ "⚡️ Slack app is running!"
✅ "Notification scheduler started"
```

## 🚀 Next Steps After Deployment

1. **Test all functionality** in your Slack workspace
2. **Add app to multiple channels** if needed
3. **Set up monitoring** (optional)
4. **Configure custom domain** (optional)

## 💰 Cost Breakdown

- **Railway Free Tier**: $0/month
  - 500 hours/month (enough for 24/7)
  - 1GB RAM
  - Shared CPU

- **MongoDB Atlas Free Tier**: $0/month
  - 512MB storage
  - Shared clusters

**Total Cost: $0/month** 🎉

## 🔄 Updating Your App

To update your app:
1. Make changes to your code
2. Push to GitHub
3. Railway auto-deploys the changes
4. No downtime!

---

**Your Slack app is now running 24/7 in the cloud!** 🌟 