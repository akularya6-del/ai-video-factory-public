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
Genrate the script using with this prompt
```
**Platform:** ChatGPT / Claude / Gemini

**Prompt:**

Generate **100 highly emotional, psychologically engaging, binge-worthy short stories** designed to maximize viewer retention on social media platforms such as TikTok, YouTube Shorts, Instagram Reels, and Facebook Reels.

### Story Requirements

Each story must:

* Trigger strong emotions (shock, sadness, hope, betrayal, love, guilt, regret, fear, curiosity, justice, revenge, redemption, etc.)
* Begin with an irresistible **hook** in the first sentence.
* Create immediate curiosity and suspense.
* Use psychological triggers that make people want to continue reading or listening.
* Include unexpected twists when appropriate.
* Build emotional tension throughout the story.
* End with a powerful payoff, revelation, emotional punch, or lesson.
* Feel realistic and relatable.
* Be written in simple, conversational English.
* Be suitable for voice-over narration.
* Be approximately 150–300 words long.
* Avoid repetitive plots and themes.
* Every story should feel unique and memorable.

### Story Categories

Mix stories across themes such as:

* Family drama
* Betrayal
* Romance
* Revenge
* Redemption
* Lost opportunities
* Acts of kindness
* Life-changing decisions
* Childhood memories
* Regret
* Unexpected success
* Sacrifice
* Friendship
* Mystery
* Secrets
* Emotional reunions

### Output Format

Return ONLY valid JSON.

Use this exact structure:

```json
[
  {
    "id": 1,
    "title": "Emotionally Compelling Title",
    "story": "Full story text with a strong hook, suspense, emotional progression, and impactful ending.",
    "used": false
  },
  {
    "id": 2,
    "title": "Emotionally Compelling Title",
    "story": "Full story text with a strong hook, suspense, emotional progression, and impactful ending.",
    "used": false
  }
]
```

### Additional Rules

* IDs must be sequential from 1 to 100.
* Every title must be unique and attention-grabbing.
* Every story must be completely original.
* Do not include explanations, markdown, comments, or extra text.
* Ensure the JSON is valid and properly escaped.
* Focus heavily on emotional storytelling, suspense, curiosity gaps, and psychological hooks that keep viewers engaged until the final sentence.
* Make the stories feel like viral social media storytelling content.
* The first sentence of every story should immediately grab attention and make the audience need to know what happens next.

---
```
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
