# Deployment Guide: Creative Story Bot on Render

## Prerequisites
- GitHub repository with your code pushed
- Render account (https://render.com/)
- Groq API Key

## Step-by-Step Deployment Instructions

### 1. Set Up Your Groq API Key
- Go to https://console.groq.com/
- Create/copy your API key
- Keep it secure - you'll need it for Render

### 2. Deploy on Render

#### Option A: Using render.yaml (Recommended)
1. Go to https://dashboard.render.com/
2. Click **"New +"** and select **"Web Service"**
3. Select **"Deploy an existing repository"** and choose your GitHub repo
4. Connect your GitHub account if prompted
5. Fill in the deployment form:
   - **Name:** `creative-story-bot` (or your preferred name)
   - **Region:** Choose closest to your users
   - **Branch:** `main`
   - **Root Directory:** Leave empty (app files are in root)
   - **Environment:** `Python 3`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `python app_web.py`
   - **Free Plan:** Select if you want free tier

6. Add Environment Variable:
   - Click **"Advanced"** section
   - Click **"Add Environment Variable"**
   - **Key:** `GROQ_API_KEY`
   - **Value:** Paste your Groq API key
   - ⚠️ **IMPORTANT:** Set it as **Secret** to protect your API key

7. Click **"Create Web Service"**
8. Wait for deployment to complete (3-5 minutes)

#### Option B: Manual Configuration
If Option A doesn't work, follow these steps:
1. Create a Web Service on Render
2. Connect your GitHub repository
3. Set these environment variables in the dashboard:
   - `FLASK_ENV=production`
   - `GROQ_API_KEY=your_api_key_here` (Mark as Secret)
4. Use these commands:
   - Build: `pip install -r requirements.txt`
   - Start: `python app_web.py`

### 3. Verify Deployment
- Check the Render dashboard for deployment status
- Once deployed, click the service URL to access your app
- Try creating a story/character to verify the Groq API connection

### 4. Troubleshooting

**App won't start:**
- Check logs in Render dashboard
- Verify `GROQ_API_KEY` is set correctly
- Ensure requirements.txt has all dependencies

**API errors:**
- Verify your Groq API key is active
- Check if you have API quota remaining
- Check Groq console for rate limits

**Port binding errors:**
- App now uses PORT environment variable (Render sets this automatically)
- No changes needed if using provided configuration

### 5. Update After Changes
1. Push changes to GitHub:
   ```bash
   git add .
   git commit -m "Update message"
   git push origin main
   ```
2. Render automatically redeploys on push (auto-deploy enabled by default)

## Environment Variables Reference
| Variable | Description | Required |
|----------|-------------|----------|
| `GROQ_API_KEY` | Your Groq API key | Yes (Mark as Secret) |
| `FLASK_ENV` | Set to `production` | No (defaults to production) |
| `PORT` | Server port (set by Render) | No (Render sets automatically) |

## Support
- Render Docs: https://render.com/docs
- Groq API Docs: https://console.groq.com/docs
- GitHub issues: Check your repo issues for help
