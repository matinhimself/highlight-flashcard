# Google Drive Integration Setup Guide

This guide explains how to set up Google Drive storage integration for the Lexis extension.

## Overview

The Lexis extension now supports automatic cloud backup and sync using Google Drive. Your flashcards and highlights are stored in your personal Google Drive, enabling:

- ☁️ Automatic cloud backup
- 🔄 Sync across all your devices
- 🔒 Your data, your control (stored in your Drive, not on external servers)

## Setup Instructions

### 1. Google Cloud Console Setup

To enable Google Drive integration, you need to create OAuth 2.0 credentials:

#### Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" → "New Project"
3. Enter project name: **Lexis Extension** (or any name you prefer)
4. Click "Create"

#### Step 2: Enable Google Drive API

1. In your project, go to **APIs & Services** → **Library**
2. Search for **Google Drive API**
3. Click on it and click **Enable**

#### Step 3: Configure OAuth Consent Screen

1. Go to **APIs & Services** → **OAuth consent screen**
2. Select **External** (unless you have a Google Workspace account)
3. Click **Create**
4. Fill in the required fields:
   - **App name:** Lexis - AI Flashcards
   - **User support email:** Your email
   - **Developer contact information:** Your email
5. Click **Save and Continue**
6. On the **Scopes** page, click **Add or Remove Scopes**
7. Add the following scope:
   - `https://www.googleapis.com/auth/drive.file` (only files created by the app)
8. Click **Update** → **Save and Continue**
9. On **Test users** page:
   - Click **Add Users**
   - Add your email address (and any other users who will test)
   - Click **Save and Continue**
10. Review and click **Back to Dashboard**

#### Step 4: Create OAuth 2.0 Client ID

1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth client ID**
3. Select **Application type:** Chrome Extension
4. **Name:** Lexis Extension OAuth
5. **Extension ID:**
   - If you're developing locally, you'll get this after loading the unpacked extension
   - For Chrome Web Store, you'll get this after publishing
   - To get the Extension ID for local development:
     1. Open Chrome and go to `chrome://extensions/`
     2. Enable "Developer mode" (top right)
     3. Click "Load unpacked" and select your extension folder
     4. Copy the Extension ID shown under your extension
6. Paste the Extension ID in the OAuth configuration
7. Click **Create**
8. Copy the **Client ID** (format: `XXXXX.apps.googleusercontent.com`)

#### Step 5: Update manifest.json

1. Open `manifest.json` in the extension folder
2. Find the `oauth2` section
3. Replace `YOUR_GOOGLE_CLIENT_ID` with your actual Client ID:

```json
"oauth2": {
  "client_id": "YOUR_ACTUAL_CLIENT_ID.apps.googleusercontent.com",
  "scopes": [
    "https://www.googleapis.com/auth/drive.file"
  ]
}
```

4. Save the file

### 2. Loading the Extension

#### For Chrome

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top right)
3. Click **Load unpacked**
4. Select the extension folder
5. The extension is now loaded!

#### For Firefox

1. Open Firefox and go to `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on**
3. Select the `manifest.json` file from the extension folder
4. The extension is now loaded!

### 3. Connecting Google Drive

1. Click the Lexis extension icon in your browser
2. Click **Settings** (gear icon)
3. Scroll to **Google Drive Storage & Sync** section
4. Click **Connect Google Drive**
5. Sign in with your Google account
6. Grant permissions (you'll see the consent screen you configured)
7. You're connected! Your data will now sync automatically

## How It Works

### Storage Structure

When you connect Google Drive, the extension creates a folder in your Drive:

```
Google Drive Root/
└── Lexis Extension Data/
    ├── flashcards.json       # All your flashcards
    ├── highlights.json       # All your highlights
    └── metadata.json         # Sync metadata
```

### Sync Behavior

- **Automatic Sync:** Every 5 minutes (if changes detected)
- **On Startup:** Syncs when extension loads
- **On Change:** Syncs 2 seconds after creating/editing/deleting items
- **Manual Sync:** Click "Sync Now" in settings anytime

### Conflict Resolution

If you edit the same flashcard on two devices:
- **Strategy:** Last-write-wins
- **Comparison:** Uses `updatedAt` or `createdAt` timestamps
- Most recent change is kept

### Offline Mode

- You can create/edit flashcards offline
- Changes are queued and sync when connection restored
- Full offline functionality maintained

## Privacy & Security

### Your Data

- **Stored in YOUR Google Drive only**
- **Never sent to external servers** (except Google Drive)
- **You have full control** - can view/edit/delete files in Drive
- **Can revoke access anytime** in Google Account settings

### Permissions

The extension only requests:
- **`drive.file` scope:** Access to files created by this app only
- **NOT full Drive access** - can't see your other files

### API Keys

- **OpenRouter API keys are NOT synced** to Drive (for security)
- **Only synced data:** Flashcards, highlights, and extension settings (not API keys)

## Troubleshooting

### "Sign-in failed" Error

**Cause:** OAuth credentials not configured correctly

**Solutions:**
1. Verify Client ID in `manifest.json` matches Google Cloud Console
2. Ensure Extension ID in Google Cloud Console matches actual extension ID
3. Check that Google Drive API is enabled in your project
4. Verify you added your email as a test user (if using external consent screen)

### "Not authenticated" in Console

**Cause:** OAuth token expired or revoked

**Solutions:**
1. Go to Settings → Sign out from Google Drive
2. Sign in again
3. If still fails, revoke access in [Google Account Settings](https://myaccount.google.com/permissions) and retry

### Files Not Syncing

**Cause:** Network issues or sync disabled

**Solutions:**
1. Check internet connection
2. Verify Google Drive is connected in Settings
3. Click "Sync Now" to manually trigger sync
4. Check browser console (F12) for error messages

### Quota Exceeded

**Cause:** Google Drive API has usage limits

**Solutions:**
- Free tier: 10,000 requests per 100 seconds per project
- If exceeded: Wait a few minutes and retry
- This is very rare for normal usage

## Publishing to Chrome Web Store

If you plan to publish the extension:

1. **Update OAuth Settings:**
   - In Google Cloud Console → OAuth consent screen
   - Change from "Testing" to "In Production"
   - Submit for verification (required for public apps)

2. **Update Extension ID:**
   - After publishing, you'll get a permanent Extension ID
   - Update the OAuth client ID in Google Cloud Console with this ID

3. **Privacy Policy:**
   - Chrome Web Store requires a privacy policy
   - See `specs/google-drive-integration.spec.md` for privacy details

## Development Tips

### Testing Locally

1. Use separate Google account for testing
2. Add test email in OAuth consent screen
3. Extension ID changes each time you reload unpacked extension
   - Update OAuth credentials each time during development
   - OR: Keep the same extension folder to maintain ID

### Debugging

Enable verbose logging:
```javascript
// In background/background.js, add at top:
const DEBUG_MODE = true;

// Then you'll see detailed sync logs in console
```

View sync data:
1. Open Chrome DevTools (F12)
2. Go to Application → Storage → Local Storage
3. Find `chrome-extension://[your-id]`
4. Look for `googleDriveEnabled`, `lastSyncTimestamp`, etc.

### Reset Everything

To start fresh:
```javascript
// In browser console (F12) while on extension page:
chrome.storage.local.clear();
```

Then reload extension and sign in again.

## File Format

### flashcards.json Structure
```json
{
  "version": "1.0",
  "lastModified": 1699564821234,
  "deviceId": "device-xxx",
  "items": [
    {
      "id": "1699564821234-abc123",
      "word": "ephemeral",
      "definition": "Lasting for a very short time",
      "data": { /* structured data */ },
      "sourceUrl": "https://example.com",
      "model": "anthropic/claude-3.5-sonnet",
      "createdAt": 1699564821234,
      "updatedAt": 1699564821234
    }
  ]
}
```

### highlights.json Structure
```json
{
  "version": "1.0",
  "lastModified": 1699564821234,
  "deviceId": "device-xxx",
  "items": [
    {
      "id": "1699564821234-abc123",
      "text": "Selected text",
      "description": "AI summary",
      "tags": ["tag1", "tag2"],
      "sourceUrl": "https://example.com",
      "createdAt": 1699564821234,
      "updatedAt": 1699564821234
    }
  ]
}
```

## Support

For issues or questions:
- Check the troubleshooting section above
- Review `/specs/google-drive-integration.spec.md` for technical details
- Check browser console (F12) for error messages
- Open an issue on the GitHub repository

## Future Enhancements

Planned features:
- [ ] Manual conflict resolution UI
- [ ] Selective sync (choose what to sync)
- [ ] Multiple Google accounts support
- [ ] Export to other formats (Notion, Evernote, etc.)
- [ ] Shared flashcard decks
- [ ] Version history / restore previous versions

---

**Note:** Google Drive integration is optional. You can continue using local storage only if you prefer.
