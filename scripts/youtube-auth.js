const { google } = require('googleapis');
const express = require('express');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const CLIENT_ID = process.env.YOUTUBE_CLIENT_ID;
const CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET;
const REDIRECT_URI = process.env.YOUTUBE_REDIRECT_URI || 'http://localhost:3000/oauth2callback';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('❌ ERROR: YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET must be set in .env');
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
const SCOPES = ['https://www.googleapis.com/auth/youtube.upload'];
const app = express();

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline', // Crucial to get a refresh token
  prompt: 'consent',      // Force consent screen to guarantee refresh token
  scope: SCOPES,
});

app.get('/oauth2callback', async (req, res) => {
  const code = req.query.code;
  if (!code) {
    return res.send('No code found in URL');
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    
    if (tokens.refresh_token) {
      console.log('\n✅ SUCCESS! Received Refresh Token.');
      console.log(`\nYour Refresh Token:\n\n${tokens.refresh_token}\n`);
      
      // Attempt to auto-write to .env
      const envPath = path.resolve(__dirname, '../.env');
      let envVars = fs.readFileSync(envPath, 'utf8');
      envVars = envVars.replace(/YOUTUBE_REFRESH_TOKEN=.*/g, `YOUTUBE_REFRESH_TOKEN=${tokens.refresh_token}`);
      fs.writeFileSync(envPath, envVars);
      
      console.log('✅ Automatically updated your .env file!');
      res.send('<h1>Authentication Successful!</h1><p>You can close this tab and check your terminal.</p>');
    } else {
      console.log('⚠️ WARNING: No refresh token returned. You might need to go to Google Account Permissions and remove the app before trying again.');
      res.send('<h1>Authenticated, but no refresh token.</h1><p>Check terminal.</p>');
    }
    
    setTimeout(() => process.exit(0), 1000);
  } catch (error) {
    console.error('Error retrieving access token', error);
    res.status(500).send('Authentication Failed');
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🔐 YouTube Authentication Script`);
  console.log(`======================================================`);
  console.log(`Please click the link below to authenticate with your YouTube account:`);
  console.log(`\n🔗 ${authUrl}\n`);
  console.log(`Waiting for callback on port ${PORT}...`);
});
