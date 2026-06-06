# 🤖 AI Video Factory (Serverless Edition)

> **Fully automated, $0/month YouTube Shorts pipeline.** Generate a story → AI voiceover → synced captions → rendered video → auto-upload to YouTube. Runs **15 times a day** across 3 channels (5 per channel) using GitHub Actions — completely hands-free.

---

## 📖 Table of Contents

1. [How It Works](#-how-it-works)
2. [What You'll Need](#-what-youll-need)
3. [Step 1 — Fork the Repository](#step-1--fork-the-repository)
4. [Step 2 — Get Your OpenAI API Key](#step-2--get-your-openai-api-key)
5. [Step 3 — Set Up Google Cloud (3 Separate Projects)](#step-3--set-up-google-cloud-3-separate-projects)
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
| Google Cloud account | Free | 3 separate projects, one per channel |
| 3 YouTube channels | Free | Can be the same Google account |
| Node.js (v18+) | Free | Only needed once for the auth setup |
| A gameplay video file | Free | Minecraft, GTA, sand-cutting, etc. |

> **No servers. No monthly subscriptions. Everything runs inside GitHub Actions for free.**

---

## Step 1 — Fork the Repository

1. Go to the top of this page and click the **Fork** button (top-right corner).
2. Select your own GitHub account.
3. Make the forked repository **Public**.
   - ✅ Public repos get **unlimited** free GitHub Actions minutes — you need this for 15 runs/day.
   - 🔒 Your API keys are stored in GitHub Secrets (never in the code), so making it public is safe.

---

## Step 2 — Get Your OpenAI API Key

This key is used to generate the AI voiceover (TTS) and sync captions (Whisper).

1. Go to **[platform.openai.com](https://platform.openai.com)**
2. Sign up or log in
3. Click your profile (top-right) → **"API keys"**  
   Or go directly to: **[platform.openai.com/api-keys](https://platform.openai.com/api-keys)**
4. Click **"+ Create new secret key"**
5. Give it a name like `ai-video-factory`
6. Click **Create secret key**
7. **Copy the key immediately** — you won't be able to see it again!  
   It looks like: `sk-proj-...`

> 💡 **Tip:** Add a small amount of credit ($5–$10) under **Settings → Billing**. Each video costs roughly $0.01–0.05 depending on story length.

---

## Step 3 — Set Up Google Cloud (3 Separate Projects)

> **Why 3 projects?** YouTube's API gives each Google Cloud project **10,000 free units per day**. Each video upload costs 1,600 units. With 5 uploads/day per channel = 8,000 units per channel. If all 3 channels share one project, that's 24,000 units — which exceeds the limit and uploads will fail. By giving each channel its own project, each gets a fresh 10,000-unit quota.

You'll repeat the steps below **3 times** — once for each channel. The steps are identical each time; just use a different project name.

---

### 🔵 Project for Channel 1

#### 3a-1. Create the Project

1. Go to **[console.cloud.google.com](https://console.cloud.google.com)**
2. Sign in with the Google account that owns your YouTube channels
3. Click the project selector dropdown at the very top of the page
4. Click **"New Project"**
5. **Project name:** `ai-video-ch1`
6. Click **Create** and wait ~10 seconds
7. Make sure `ai-video-ch1` is selected in the top dropdown before continuing

#### 3b-1. Enable the YouTube Data API

1. In the search bar at the top, type **`YouTube Data API v3`**
2. Click on it in the results
3. Click the blue **"Enable"** button
4. Wait ~10 seconds for it to activate

#### 3c-1. Set Up the OAuth Consent Screen

> This tells Google what your "app" is — it's just for your own use.

1. In the left sidebar → **APIs & Services → OAuth consent screen**
2. Choose **"External"** → click **Create**
3. Fill in the required fields:
   - **App name:** `AI Video Factory Ch1`
   - **User support email:** your email
   - **Developer contact email:** your email
4. Click **Save and Continue**
5. On the **Scopes** page — click **Save and Continue** (no changes needed)
6. On the **Test users** page:
   - Click **"+ Add Users"**
   - Add the Gmail address of the Google account for **Channel 1**
   - Click **Save and Continue**
7. Click **Back to Dashboard**

> ⚠️ You MUST add yourself as a Test User or the authentication will fail!

#### 3d-1. Create OAuth Credentials

1. In the left sidebar → **APIs & Services → Credentials**
2. Click **"+ Create Credentials"** → **"OAuth client ID"**
3. **Application type:** `Web application`
4. **Name:** `ai-video-ch1`
5. Under **Authorized redirect URIs** → click **"+ Add URI"** → enter:
   ```
   http://localhost:3000/oauth2callback
   ```
6. Click **Create**
7. A popup appears — **copy and save both values:**
   - **Client ID** → `123456789-abc...apps.googleusercontent.com`
   - **Client Secret** → `GOCSPX-...`

> 💾 Label these clearly as **"Channel 1 Client ID"** and **"Channel 1 Client Secret"** in your notes.

---

### 🟢 Project for Channel 2

Repeat the exact same 4 steps above, but use these names:

| Field | Value |
|---|---|
| Project name | `ai-video-ch2` |
| App name (consent screen) | `AI Video Factory Ch2` |
| OAuth credential name | `ai-video-ch2` |
| Test user to add | Gmail of the account for **Channel 2** |

Save the resulting **Client ID** and **Client Secret** labelled as **"Channel 2"**.

---

### 🔴 Project for Channel 3

Repeat again with:

| Field | Value |
|---|---|
| Project name | `ai-video-ch3` |
| App name (consent screen) | `AI Video Factory Ch3` |
| OAuth credential name | `ai-video-ch3` |
| Test user to add | Gmail of the account for **Channel 3** |

Save the resulting **Client ID** and **Client Secret** labelled as **"Channel 3"**.

---

> ✅ After this step you should have **6 values** saved:
> - Channel 1 Client ID + Secret
> - Channel 2 Client ID + Secret
> - Channel 3 Client ID + Secret

---

## Step 4 — Get Your YouTube Refresh Tokens

A Refresh Token lets the pipeline upload to YouTube on your behalf — without you needing to log in every time. You'll get one token per channel, using the credentials of its matching Google Cloud project.

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

In the project folder, create a file called `.env` (no extension). Fill in the credentials for **Channel 1 first**:

```env
OPENAI_API_KEY=sk-proj-YOUR_KEY_HERE

# Channel 1 credentials (swap these out for each channel when running the auth script)
YOUTUBE_CLIENT_ID=CHANNEL_1_CLIENT_ID_HERE
YOUTUBE_CLIENT_SECRET=CHANNEL_1_CLIENT_SECRET_HERE
YOUTUBE_REDIRECT_URI=http://localhost:3000/oauth2callback
```

> 💡 On Mac, files starting with `.` are hidden by default. Use a code editor like [VS Code](https://code.visualstudio.com/) to create and edit the file.

### 4c. Get the Refresh Token for Channel 1

Run this in your terminal:

```bash
node scripts/youtube-auth.js
```

A long URL will appear. **Click or copy it** and open it in your browser.

1. Sign in with the Google account for **Channel 1**
2. You'll see a warning — "Google hasn't verified this app" — click **"Advanced"** → **"Go to AI Video Factory Ch1 (unsafe)"**  
   > This is completely safe — it's your own app talking to your own channel.
3. Click **Allow** → **Allow** again
4. Your browser will show **"Authentication Successful!"**
5. Go back to your terminal — you'll see:

```
✅ SUCCESS! Received Refresh Token.

Your Refresh Token:

1//0gXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

6. **Copy that token** and save it as **"Channel 1 Refresh Token"**

### 4d. Get the Refresh Token for Channel 2

1. Open your `.env` file and **swap the credentials** to Channel 2's values:

```env
YOUTUBE_CLIENT_ID=CHANNEL_2_CLIENT_ID_HERE
YOUTUBE_CLIENT_SECRET=CHANNEL_2_CLIENT_SECRET_HERE
```

2. Run the auth script again:

```bash
node scripts/youtube-auth.js
```

3. Open the new URL in your browser, sign in with the **Channel 2** Google account, allow access
4. Copy the token → save as **"Channel 2 Refresh Token"**

### 4e. Get the Refresh Token for Channel 3

1. Swap the `.env` credentials to Channel 3:

```env
YOUTUBE_CLIENT_ID=CHANNEL_3_CLIENT_ID_HERE
YOUTUBE_CLIENT_SECRET=CHANNEL_3_CLIENT_SECRET_HERE
```

2. Run the auth script one more time:

```bash
node scripts/youtube-auth.js
```

3. Sign in with the **Channel 3** Google account → copy the token → save as **"Channel 3 Refresh Token"**

---

> ✅ After this step you should have **3 refresh tokens** (one per channel) plus the 6 credentials from Step 3. That's **9 values total** — all going into GitHub Secrets next.

> ⚠️ **No refresh token appeared?** This happens if you've authorized the app before. Go to [myaccount.google.com/permissions](https://myaccount.google.com/permissions), remove the relevant `AI Video Factory` app, then run the script again.

> 💡 **All 3 channels on the same Google account?** You'll still run the script 3 times with 3 different sets of Client ID/Secret (one per project). If Google doesn't ask you to pick a channel during auth, sign out of extra accounts in the browser first, then retry.

---

## Step 5 — Add Gameplay Footage

GitHub has a 100MB file size limit, so you need to add your own background video.

1. Download a **copyright-free** background video. Good options:
   - Minecraft Parkour
   - GTA V driving / racing
   - Satisfying sand cutting / kinetic sand
   - Subway Surfers gameplay
   - Search "no copyright gameplay footage free download" on YouTube or use [Pixabay](https://pixabay.com/videos/) or [Pexels](https://www.pexels.com/videos/)

2. **Compress the video to under 100MB**
   - Use [Handbrake](https://handbrake.fr/) (free desktop app)
   - Or use an online compressor like [freeconvert.com/video-compressor](https://www.freeconvert.com/video-compressor)
   - Target resolution: 1080×1920 (vertical/portrait)

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

Now you'll give your GitHub repository all the credentials it needs. Because each channel has its own Google Cloud project, you'll have **9 secrets** total.

1. Go to your **forked repository** on GitHub
2. Click **Settings** (top tab bar)
3. In the left sidebar → **Secrets and variables** → **Actions**
4. Click **"New repository secret"** for each of the following:

| Secret Name | What it is | Where to get it |
|---|---|---|
| `OPENAI_API_KEY` | OpenAI API key | Step 2 — starts with `sk-proj-...` |
| `YOUTUBE_CLIENT_ID_CHANNEL_1` | Channel 1 OAuth Client ID | Step 3 (Channel 1 project) |
| `YOUTUBE_CLIENT_SECRET_CHANNEL_1` | Channel 1 OAuth Client Secret | Step 3 (Channel 1 project) |
| `YOUTUBE_REFRESH_TOKEN_CHANNEL_1` | Channel 1 refresh token | Step 4c |
| `YOUTUBE_CLIENT_ID_CHANNEL_2` | Channel 2 OAuth Client ID | Step 3 (Channel 2 project) |
| `YOUTUBE_CLIENT_SECRET_CHANNEL_2` | Channel 2 OAuth Client Secret | Step 3 (Channel 2 project) |
| `YOUTUBE_REFRESH_TOKEN_CHANNEL_2` | Channel 2 refresh token | Step 4d |
| `YOUTUBE_CLIENT_ID_CHANNEL_3` | Channel 3 OAuth Client ID | Step 3 (Channel 3 project) |
| `YOUTUBE_CLIENT_SECRET_CHANNEL_3` | Channel 3 OAuth Client Secret | Step 3 (Channel 3 project) |
| `YOUTUBE_REFRESH_TOKEN_CHANNEL_3` | Channel 3 refresh token | Step 4e |

> ⚠️ Secret names must be **exactly** as shown — no spaces, capital letters matter.

---

## Step 8 — Fire It Up!

### Test it manually first

1. Go to the **Actions** tab in your GitHub repository
2. Click **"Autonomous Video Factory (3 Channels)"** in the left sidebar
3. Click **"Run workflow"** on the right side
4. In the dropdown, select `channel_1`
5. Click the green **"Run workflow"** button

The workflow will take about **3–5 minutes** to complete. You'll see a green checkmark when done, and a new Short will appear on Channel 1!

Repeat for `channel_2` and `channel_3` to verify all three channels work.

### Let it run on autopilot

Once you've confirmed it works manually, the built-in schedule takes over:

| Channel | Post Times (UTC) |
|---|---|
| Channel 1 | 12:00 AM, 5:00 AM, 10:00 AM, 3:00 PM, 8:00 PM |
| Channel 2 | 1:00 AM, 6:00 AM, 11:00 AM, 4:00 PM, 9:00 PM |
| Channel 3 | 2:00 AM, 7:00 AM, 12:00 PM, 5:00 PM, 10:00 PM |

That's **15 videos per day, fully automated, for free.** 🚀

---

## 📅 How the Schedule Works

Channels are staggered by 1 hour so they never run at the same time. Each channel posts every ~5 hours:

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
> **India (IST):** UTC + 5:30 &nbsp;|&nbsp; **US East:** UTC − 4 &nbsp;|&nbsp; **US West:** UTC − 7 &nbsp;|&nbsp; **UK (BST):** UTC + 1

---

## 💰 Cost Breakdown

| Service | What it's used for | Estimated cost per video |
|---|---|---|
| OpenAI TTS (`tts-1`) | AI voiceover | ~$0.008 |
| OpenAI Whisper | Caption sync | ~$0.003 |
| GitHub Actions | Compute + rendering | **Free** (unlimited on public repos) |
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
2. Find and remove the relevant `AI Video Factory` app
3. Run `node scripts/youtube-auth.js` again (with the correct channel's credentials in `.env`)

### ❌ "YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET must be set in .env"
Your `.env` file is missing or has wrong values. Make sure you've swapped in the correct channel's credentials before running the auth script.

### ❌ GitHub Action fails with "401 Unauthorized" or "403 Forbidden"
One of the secrets is wrong or expired. Check which channel failed in the Action logs, then re-enter the Client ID, Client Secret, and Refresh Token for that channel in **Settings → Secrets**.

### ❌ "Quota exceeded" error in the logs
All 3 channels are using the same Google Cloud project. Make sure each channel has its own project with separate Client ID/Secret secrets (`YOUTUBE_CLIENT_ID_CHANNEL_1`, `YOUTUBE_CLIENT_ID_CHANNEL_2`, etc.).

### ❌ "No unused scripts found"
All stories in your `scripts.json` have `"used": true`. Add more stories (go back to Step 6).

### ❌ Video file too large for GitHub
Compress your footage to under 100MB using [Handbrake](https://handbrake.fr/) or an online tool.

### ❌ The workflow runs but nothing uploads to YouTube
Check that:
- The OAuth consent screen for that channel's project has the correct Gmail as a Test User (Step 3c)
- The refresh token in the secret matches the credentials used in Step 4
- The YouTube channel is in good standing (not restricted or terminated)

---

## 📌 Quick Reference — All 10 Secrets

```
OPENAI_API_KEY                    → platform.openai.com/api-keys

YOUTUBE_CLIENT_ID_CHANNEL_1       → Google Cloud project: ai-video-ch1
YOUTUBE_CLIENT_SECRET_CHANNEL_1   → Google Cloud project: ai-video-ch1
YOUTUBE_REFRESH_TOKEN_CHANNEL_1   → node scripts/youtube-auth.js (with Ch1 creds)

YOUTUBE_CLIENT_ID_CHANNEL_2       → Google Cloud project: ai-video-ch2
YOUTUBE_CLIENT_SECRET_CHANNEL_2   → Google Cloud project: ai-video-ch2
YOUTUBE_REFRESH_TOKEN_CHANNEL_2   → node scripts/youtube-auth.js (with Ch2 creds)

YOUTUBE_CLIENT_ID_CHANNEL_3       → Google Cloud project: ai-video-ch3
YOUTUBE_CLIENT_SECRET_CHANNEL_3   → Google Cloud project: ai-video-ch3
YOUTUBE_REFRESH_TOKEN_CHANNEL_3   → node scripts/youtube-auth.js (with Ch3 creds)
```

---

*Built with ❤️ for creators who want to automate their content without spending a dime on infrastructure.*
