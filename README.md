# 🤖 AI Video Factory (Serverless Edition)

A fully automated, $0/month serverless video generation pipeline that creates, edits, and posts YouTube Shorts across 3 different channels using GitHub Actions.

## Features
- **Zero Hosting Costs**: Runs entirely on GitHub Actions runners.
- **Multi-Channel**: Automatically manages and uploads to 3 separate YouTube channels on staggered schedules.
- **Fully Autonomous**: Runs 9 times a day (3 per channel) without any manual intervention.
- **Pre-loaded Content**: Reads from a pre-loaded `scripts.json` file, eliminating the cost of AI script generation.
- **Pro-Level Editing**: Uses OpenAI TTS for lifelike voiceovers, Whisper for perfect subtitle syncing, and FFmpeg for fast rendering with Impact font, word-by-word pop-up captions, and background music.

---

## 🚀 Quick Start Guide

### 1. Setup Your GitHub Repository
1. Fork or clone this repository.
2. If cloning, push it to a **Private** repository on your own GitHub account (you don't want others stealing your scripts!).

### 2. Add Gameplay Footage & BGM
Since large video files can't easily be stored on GitHub, you need to add your own background gameplay footage.
1. Download a copyright-free background video (like Minecraft Parkour, GTA V racing, or satisfying sand cutting).
2. Compress the video to be under 100MB (GitHub's file limit). You can use a tool like Handbrake or an online compressor.
3. Save the file as exactly: `footage/gameplay/G1_lite.mp4`.
4. (Optional) Add background music by placing a file named `G2.mp3` in the root of the repository.

### 3. Pre-load Your Scripts
The factory reads stories sequentially from JSON files.
1. Open `content/channel_1/scripts.json`.
2. Add your scripts using the following format:
```json
[
  {
    "id": 1,
    "title": "Title of the Video",
    "story": "The actual script that will be read by the AI voice...",
    "used": false
  }
]
```
3. Repeat for `channel_2` and `channel_3`.
4. *Note: As the pipeline runs, it will automatically mark `used: true` and commit the file back to GitHub so it never repeats a story!*

### 4. Get Your YouTube Refresh Tokens
You need to authorize the bot to upload to your YouTube channels.
1. On your local computer, open your terminal and run: `npm install`
2. Make sure you have your YouTube Client ID and Secret in a local `.env` file (see `.env.example`).
3. Run the auth script:
```bash
node scripts/youtube-auth.js
```
4. Click the link that appears, sign in with your Google Account, and select **Channel 1**.
5. Copy the long `Refresh Token` that prints in your terminal.
6. Run the script again and select **Channel 2**, then again for **Channel 3**.

### 5. Add GitHub Secrets
Go to your GitHub Repository -> **Settings** -> **Secrets and variables** -> **Actions**. Add these 6 exact secrets:

| Secret Name | Value |
|---|---|
| `OPENAI_API_KEY` | Your OpenAI API Key |
| `YOUTUBE_CLIENT_ID` | Your Google Cloud OAuth Client ID |
| `YOUTUBE_CLIENT_SECRET` | Your Google Cloud OAuth Client Secret |
| `YOUTUBE_REFRESH_TOKEN_CHANNEL_1` | The token you got for Channel 1 |
| `YOUTUBE_REFRESH_TOKEN_CHANNEL_2` | The token you got for Channel 2 |
| `YOUTUBE_REFRESH_TOKEN_CHANNEL_3` | The token you got for Channel 3 |

### 6. Fire It Up!
1. Go to the **Actions** tab in your GitHub repository.
2. Click **"Autonomous Video Factory (3 Channels)"** on the left.
3. Click **"Run workflow"** on the right.
4. Select `channel_1` and hit the green button!

Once you verify it works manually, the built-in schedule will take over. It will automatically run 3 times a day for each of your 3 channels, giving you 9 fully automated videos per day while you sleep!

---

## 🛠 Tech Stack
- **Compute**: GitHub Actions (`ubuntu-latest`)
- **Voice**: OpenAI TTS (`tts-1`)
- **Captions**: OpenAI Whisper API (`whisper-1`)
- **Rendering**: FFmpeg (`libx264`)
- **Storage**: Git Commits (The repo acts as the database for `scripts.json`)
- **API**: YouTube Data API v3
