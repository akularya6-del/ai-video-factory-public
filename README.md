# 🤖 AI Video Factory (Serverless Edition)

> **Fully automated, $0/month YouTube Shorts pipeline.** Generate a story → AI voiceover → synced captions → rendered video → auto-upload to YouTube. Runs **15 times a day** across 3 channels (5 per channel) using GitHub Actions — completely hands-free.

---

## 📖 Table of Contents

1. [How It Works](#-how-it-works)
2. [What You'll Need](#-what-youll-need)
3. [Step 1 — Fork the Repository](#step-1--fork-the-repository)
4. [Step 2 — Get Your OpenAI API Key](#step-2--get-your-openai-api-key)
5. [Step 3 — Set Up Google Cloud & YouTube API](#step-3--set-up-google-cloud--youtube-api)
6. [Step 4 — Get Your YouTube Refresh Tokens](#step-4--get-your-youtube-refresh-tokens)
7. [Step 5 — Add Gameplay Footage](#step-5--add-gameplay-footage)
8. [Step 6 — Pre-load Your Scripts](#step-6--pre-load-your-scripts)
9. [Step 7 — Add Secrets to GitHub](#step-7--add-secrets-to-github)
10. [Step 8 — Fire It Up!](#step-8--fire-it-up)
11. [How the Schedule Works](#-how-the-schedule-works)
12. [Cost Breakdown](#-cost-breakdown)
13. [Tech Stack](#-tech-stack)
14. [Troubleshooting](#-troubleshooting)

---

## 🔁 How It Works

```
scripts.json  →  AI Voice (OpenAI TTS)  →  Captions (Whisper)  →  FFmpeg Render  →  YouTube Upload
```

Every time the pipeline runs, it:
1. Picks the next unused story from your `scripts.json` file
2. Converts it to a lifelike AI voiceover using OpenAI TTS
3. Syncs word-by-word captions using OpenAI Whisper
4. Renders a vertical 9:16 video (with your gameplay footage + captions + BGM) using FFmpeg
5. Uploads it to YouTube Shorts automatically
6. Marks the story as `used` so it never repeats

---

## 🧰 What You'll Need

| Requirement | Cost | Notes |
|---|---|---|
| GitHub account | Free | github.com |
| OpenAI account | ~$0.01–0.05 per video | Only TTS + Whisper used |
| Google Cloud account | Free | Only the free tier is needed |
| 3 YouTube channels | Free | Can be the same Google account |
| Node.js (v18+) | Free | Only needed once for auth setup |
| A gameplay video file | Free | Minecraft, GTA, sand-cutting, etc. |

> **No servers. No monthly subscriptions. Everything runs inside GitHub Actions for free.**

---

## Step 1 — Fork the Repository

1. Go to the top of this page and click the **Fork** button (top-right corner).
2. Select your own GitHub account.
3. Make the forked repository **Private** (Settings → Change visibility → Private).
   - ⚠️ *Keep it private so no one can steal your scripts or tokens!*

---

## Step 2 — Get Your OpenAI API Key

This key is used to generate the AI voiceover (TTS) and sync captions (Whisper).

1. Go to **[platform.openai.com](https://platform.openai.com)**
2. Sign up or log in
3. Click your profile (top-right) → **"Your profile"** → **"API keys"**  
   Or go directly to: **[platform.openai.com/api-keys](https://platform.openai.com/api-keys)**
4. Click **"+ Create new secret key"**
5. Give it a name like `ai-video-factory`
6. Click **Create secret key**
7. **Copy the key immediately** — you won't be able to see it again!
   It looks like: `sk-proj-...`

> 💡 **Tip:** Add a small amount of credit ($5–$10) under **Settings → Billing**. Each video costs roughly $0.01–0.05 depending on story length.

---

## Step 3 — Set Up Google Cloud & YouTube API

This is the most involved step, but you only do it once. Follow each step carefully.

### 3a. Create a Google Cloud Project

1. Go to **[console.cloud.google.com](https://console.cloud.google.com)**
2. Sign in with the Google account that owns your YouTube channels
3. Click the project selector at the top → **"New Project"**
4. Name it something like `ai-video-factory` → click **Create**
5. Make sure your new project is selected at the top

### 3b. Enable the YouTube Data API

1. In the search bar at the top, type **"YouTube Data API v3"**
2. Click on it in the results
3. Click the blue **"Enable"** button
4. Wait for it to enable (takes ~10 seconds)

### 3c. Set Up the OAuth Consent Screen

> This tells Google what your "app" is — it's just for your own use.

1. In the left sidebar, go to **APIs & Services → OAuth consent screen**
2. Choose **"External"** → click **Create**
3. Fill in the required fields:
   - **App name:** `AI Video Factory` (anything works)
   - **User support email:** your email
   - **Developer contact email:** your email
4. Click **Save and Continue**
5. On the **Scopes** page — click **Save and Continue** (no changes needed)
6. On the **Test users** page:
   - Click **"+ Add Users"**
   - Add the Gmail address(es) for all your YouTube channels
   - Click **Save and Continue**
7. Click **Back to Dashboard**

> ⚠️ **Important:** You must add yourself as a Test User or the auth will fail!

### 3d. Create OAuth Credentials

1. In the left sidebar, go to **APIs & Services → Credentials**
2. Click **"+ Create Credentials"** → **"OAuth client ID"**
3. For **Application type**, choose **"Web application"**
4. Name it `ai-video-factory`
5. Under **Authorized redirect URIs**, click **"+ Add URI"** and enter:
   ```
   http://localhost:3000/oauth2callback
   ```
6. Click **Create**
7. A popup appears — **copy both values:**
   - **Client ID** → looks like `123456789-abc...apps.googleusercontent.com`
   - **Client Secret** → looks like `GOCSPX-...`

> 💾 Save these somewhere safe — you'll need them in the next steps.

---

## Step 4 — Get Your YouTube Refresh Tokens

A Refresh Token lets the pipeline upload to YouTube on your behalf — without needing you to log in every time.

> ⚠️ **You need to do this step on your own computer.** You'll need [Node.js](https://nodejs.org) installed. Download the "LTS" version if you don't have it.

### 4a. Clone your fork locally and set up

Open your **Terminal** (Mac/Linux) or **Command Prompt** (Windows) and run:

```bash
# Clone YOUR forked repo (replace YOUR_USERNAME with your GitHub username)
git clone https://github.com/YOUR_USERNAME/ai-video-factory-public.git
cd ai-video-factory-public

# Install dependencies
npm install
```

### 4b. Create your local `.env` file

In the project folder, create a file called `.env` (no extension) with this content:

```env
OPENAI_API_KEY=sk-proj-YOUR_KEY_HERE

YOUTUBE_CLIENT_ID=YOUR_CLIENT_ID_HERE
YOUTUBE_CLIENT_SECRET=YOUR_CLIENT_SECRET_HERE
YOUTUBE_REDIRECT_URI=http://localhost:3000/oauth2callback

YOUTUBE_REFRESH_TOKEN_CHANNEL_1=
YOUTUBE_REFRESH_TOKEN_CHANNEL_2=
YOUTUBE_REFRESH_TOKEN_CHANNEL_3=
```

Replace the values with your actual keys from Steps 2 and 3.

> 💡 On Mac, files starting with `.` are hidden by default. Use a code editor like [VS Code](https://code.visualstudio.com/) to create and edit the file.

### 4c. Get the refresh token for Channel 1

Run this command in your terminal:

```bash
node scripts/youtube-auth.js
```

You'll see a long URL printed in the terminal. **Click or copy that link** and open it in your browser.

1. Sign in with the Google account for **Channel 1**
2. You'll see a warning that says "Google hasn't verified this app" — click **"Advanced"** → **"Go to ai-video-factory (unsafe)"**
   > This is safe — it's your own app talking to your own YouTube channel.
3. Click **Allow** → **Allow** again
4. Your browser will show **"Authentication Successful!"**
5. Go back to your terminal — you'll see:

```
✅ SUCCESS! Received Refresh Token.

Your Refresh Token:

1//0gXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

6. **Copy that long token** and paste it somewhere safe (e.g., a Notes file)

### 4d. Get tokens for Channel 2 and Channel 3

Run the script again for each additional channel:

```bash
node scripts/youtube-auth.js
```

Each time, a new browser link will appear. Open it, sign in with the correct Google account for that channel, and copy the token.

> 💡 **If you manage all 3 channels from the same Google account:** You'll still run the script 3 times, but you'll need to select the correct channel each time Google asks. If Google doesn't ask you to pick a channel and goes straight through, you might need to sign out of your other Google accounts in the browser first, then repeat.

> ⚠️ **No refresh token appeared?** This can happen if you've authorized the app before. Go to [myaccount.google.com/permissions](https://myaccount.google.com/permissions), remove `ai-video-factory`, then run the script again.

---

## Step 5 — Add Gameplay Footage

GitHub has a 100MB file size limit, so you need to add your own background video.

1. Download a **copyright-free** background video. Good options:
   - Minecraft Parkour
   - GTA V driving / racing
   - Satisfying sand cutting / kinetic sand
   - Subway Surfers gameplay
   - Search "no copyright gameplay footage free download" on YouTube or use sites like [Pixabay](https://pixabay.com/videos/) or [Pexels](https://www.pexels.com/videos/)

2. **Compress the video to under 100MB**
   - Use [Handbrake](https://handbrake.fr/) (free desktop app)
   - Or use an online compressor like [freeconvert.com/video-compressor](https://www.freeconvert.com/video-compressor)
   - Target resolution: 1080x1920 (vertical/portrait) or crop a horizontal video

3. **Name the file exactly:** `G1_lite.mp4`

4. **Place it in:** `footage/gameplay/G1_lite.mp4`

5. *(Optional)* Add background music:
   - Place an MP3 file named `G2.mp3` in the **root** of the repository
   - Make sure it's copyright-free (try [incompetech.com](https://incompetech.com) or [pixabay.com/music](https://pixabay.com/music/))

---

## Step 6 — Pre-load Your Scripts

The pipeline reads stories from JSON files. You need to fill these in before running.

### Generate your scripts with AI

Copy and paste this prompt into **ChatGPT, Claude, or Gemini:**

<details>
<summary>📋 Click to expand the full prompt</summary>

```
Generate 100 highly emotional, psychologically engaging, binge-worthy short stories designed to maximize viewer retention on YouTube Shorts, TikTok, and Instagram Reels.

Each story must:
- Trigger strong emotions (shock, sadness, hope, betrayal, love, guilt, regret, fear, curiosity, justice, revenge, redemption)
- Begin with an irresistible hook in the first sentence
- Create immediate curiosity and suspense
- Include unexpected twists
- End with a powerful payoff or emotional punch
- Be written in simple, conversational English
- Be suitable for voice-over narration
- Be approximately 150–300 words long

Mix stories across themes: family drama, betrayal, romance, revenge, redemption, lost opportunities, acts of kindness, life-changing decisions, regret, unexpected success, sacrifice, friendship, mystery, secrets, emotional reunions.

Return ONLY valid JSON using this exact structure — no markdown, no extra text:

[
  {
    "id": 1,
    "title": "Emotionally Compelling Title",
    "story": "Full story text with a strong hook, suspense, emotional progression, and impactful ending.",
    "used": false
  }
]

IDs must be sequential from 1 to 100. Every title must be unique. Every story must be completely original.
```

</details>

### Add the scripts to your repo

1. Open `content/channel_1/scripts.json`
2. Paste the full JSON array that the AI gave you
3. Save the file
4. Repeat for `content/channel_2/scripts.json` and `content/channel_3/scripts.json`
   - Use a **different** batch of stories for each channel so they don't post the same content

> 💡 **How it tracks progress:** Each time a video is posted, the pipeline automatically sets `"used": true` on that story and commits the update back to your repo. It'll never repeat a story!

---

## Step 7 — Add Secrets to GitHub

Now you'll give your GitHub repository the API keys it needs to run the pipeline.

1. Go to your **forked repository** on GitHub
2. Click **Settings** (top tab bar)
3. In the left sidebar, click **Secrets and variables** → **Actions**
4. Click **"New repository secret"** for each of the following:

| Secret Name | Where to get it |
|---|---|
| `OPENAI_API_KEY` | From Step 2 — starts with `sk-proj-...` |
| `YOUTUBE_CLIENT_ID` | From Step 3d — ends with `...apps.googleusercontent.com` |
| `YOUTUBE_CLIENT_SECRET` | From Step 3d — starts with `GOCSPX-...` |
| `YOUTUBE_REFRESH_TOKEN_CHANNEL_1` | From Step 4c — the long token for Channel 1 |
| `YOUTUBE_REFRESH_TOKEN_CHANNEL_2` | From Step 4d — the long token for Channel 2 |
| `YOUTUBE_REFRESH_TOKEN_CHANNEL_3` | From Step 4d — the long token for Channel 3 |

> ⚠️ Secret names must be **exactly** as shown above — no spaces, capital letters matter.

---

## Step 8 — Fire It Up!

### Test it manually first

1. Go to the **Actions** tab in your GitHub repository
2. Click **"Autonomous Video Factory (3 Channels)"** in the left sidebar
3. Click **"Run workflow"** on the right side
4. In the dropdown, select `channel_1`
5. Click the green **"Run workflow"** button

The workflow will take about **3–5 minutes** to complete. You'll see a green checkmark when done, and a new Short will appear on your Channel 1!

### Let it run on autopilot

Once you've confirmed it works manually, you're done! The built-in schedule takes over automatically:

| Channel | Post Times (UTC) |
|---|---|
| Channel 1 | 12:00 AM, 5:00 AM, 10:00 AM, 3:00 PM, 8:00 PM |
| Channel 2 | 1:00 AM, 6:00 AM, 11:00 AM, 4:00 PM, 9:00 PM |
| Channel 3 | 2:00 AM, 7:00 AM, 12:00 PM, 5:00 PM, 10:00 PM |

That's **15 videos per day, fully automated, for free.** 🚀

---

## 📅 How the Schedule Works

GitHub Actions runs on a cron schedule. The 3 channels are staggered by 1 hour so they don't run at the same time and compete for resources. Each channel posts every ~5 hours:

```
00:00 UTC → Channel 1
01:00 UTC → Channel 2
02:00 UTC → Channel 3
05:00 UTC → Channel 1
06:00 UTC → Channel 2
07:00 UTC → Channel 3
10:00 UTC → Channel 1
11:00 UTC → Channel 2
12:00 UTC → Channel 3
15:00 UTC → Channel 1
16:00 UTC → Channel 2
17:00 UTC → Channel 3
20:00 UTC → Channel 1
21:00 UTC → Channel 2
22:00 UTC → Channel 3
```

> 💡 GitHub Actions schedules run in UTC. Add your timezone offset to find your local post times.

> ⚠️ **YouTube API Quota Note:** YouTube allows 10,000 API units per Google Cloud project per day. Each upload costs 1,600 units. To safely run 5 uploads/day per channel, create a **separate Google Cloud project for each channel** (each gets its own 10,000 unit quota). See Step 3 for how to create a project. For channels 2 and 3, add separate `YOUTUBE_CLIENT_ID_CHANNEL_2`, `YOUTUBE_CLIENT_SECRET_CHANNEL_2` etc. secrets — or simply request a free quota increase at [console.cloud.google.com/iam-admin/quotas](https://console.cloud.google.com/iam-admin/quotas).

> ⚠️ **GitHub Actions Minutes Note:** Private repos get 2,000 free minutes/month. At 15 runs/day (~5 min each) = ~2,250 min/month. To avoid overages, either make the repo **Public** (unlimited free minutes) or keep it private and monitor usage under **Settings → Billing**.

---

## 💰 Cost Breakdown

| Service | What it's used for | Estimated cost per video |
|---|---|---|
| OpenAI TTS (`tts-1`) | AI voiceover | ~$0.008 |
| OpenAI Whisper | Caption sync | ~$0.003 |
| GitHub Actions | Compute + rendering | **Free** (2,000 min/month on free tier) |
| YouTube API | Video upload | **Free** |
| **Total** | | **~$0.01–0.05 per video** |

At 15 videos/day × 30 days = 450 videos/month ≈ **$5–$25/month in OpenAI credits** at most.

---

## 🛠 Tech Stack

| Component | Technology |
|---|---|
| Compute | GitHub Actions (`ubuntu-latest`) |
| Voice | OpenAI TTS (`tts-1`) |
| Captions | OpenAI Whisper API (`whisper-1`) |
| Video Rendering | FFmpeg (`libx264`) |
| Script Storage | Git commits (your repo = your database) |
| Upload | YouTube Data API v3 |

---

## 🐛 Troubleshooting

### ❌ "No refresh token returned"
This happens when you've previously authorized the app and Google skips the consent screen.
1. Go to [myaccount.google.com/permissions](https://myaccount.google.com/permissions)
2. Find and remove `ai-video-factory`
3. Run `node scripts/youtube-auth.js` again

### ❌ "YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET must be set in .env"
Your `.env` file is missing or has wrong values. Double-check Step 4b.

### ❌ GitHub Action fails with "Permission denied" or "401 Unauthorized"
One of your secrets is wrong or expired. Go to **Settings → Secrets** and re-enter the affected key.

### ❌ "No unused scripts found"
All stories in your `scripts.json` have `"used": true`. Add more stories (go back to Step 6).

### ❌ Video file too large for GitHub
Compress your footage file to under 100MB using [Handbrake](https://handbrake.fr/) or an online tool.

### ❌ The workflow runs but nothing uploads to YouTube
Check that:
- The correct refresh token is in the secret for that channel
- Your YouTube channel is in good standing (not restricted)
- The OAuth consent screen has your email added as a Test User (Step 3c)

---

## 📌 Quick Reference — All Secrets Needed

```
OPENAI_API_KEY                    → platform.openai.com/api-keys
YOUTUBE_CLIENT_ID                 → Google Cloud Console → Credentials
YOUTUBE_CLIENT_SECRET             → Google Cloud Console → Credentials
YOUTUBE_REFRESH_TOKEN_CHANNEL_1   → node scripts/youtube-auth.js (Channel 1)
YOUTUBE_REFRESH_TOKEN_CHANNEL_2   → node scripts/youtube-auth.js (Channel 2)
YOUTUBE_REFRESH_TOKEN_CHANNEL_3   → node scripts/youtube-auth.js (Channel 3)
```

---

*Built with ❤️ for creators who want to automate their content without spending a dime on infrastructure.*
