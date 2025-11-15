# Google Drive Setup for Microsoft Edge

Quick setup guide for Microsoft Edge users.

## The Issue

Microsoft Edge doesn't support the `chrome.identity.getAuthToken()` API that Chrome uses. However, the extension automatically detects Edge and uses the compatible `launchWebAuthFlow()` method instead.

## Setup Steps for Edge

### 1. Get Your Extension ID

1. Open Microsoft Edge
2. Go to `edge://extensions/`
3. Enable **Developer mode** (left sidebar)
4. Click **Load unpacked**
5. Select the Lexis extension folder
6. Copy the **Extension ID** (it looks like: `abcdefghijklmnopqrstuvwxyz`)

### 2. Create OAuth Credentials in Google Cloud

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create or select your project
3. Enable **Google Drive API**
4. Configure **OAuth consent screen** (see main setup guide)
5. Go to **APIs & Services** → **Credentials**
6. Click **Create Credentials** → **OAuth client ID**

**IMPORTANT FOR EDGE:**
- Select **Application type:** **Web application** (NOT Chrome Extension)
- **Name:** Lexis Extension OAuth (Edge)
- **Authorized redirect URIs:** Add this URL (replace with your Extension ID):
  ```
  https://YOUR_EXTENSION_ID.chromiumapp.org/
  ```
  Example: `https://abcdefghijklmnopqrstuvwxyz.chromiumapp.org/`

7. Click **Create**
8. Copy the **Client ID** (format: `123456789.apps.googleusercontent.com`)

### 3. Update manifest.json

1. Open `manifest.json` in the extension folder
2. Find the `oauth2` section
3. Replace `YOUR_GOOGLE_CLIENT_ID` with your Client ID:

```json
"oauth2": {
  "client_id": "123456789.apps.googleusercontent.com",
  "scopes": [
    "https://www.googleapis.com/auth/drive.file"
  ]
}
```

4. Save the file
5. Reload the extension in Edge (`edge://extensions/` → click reload)

### 4. Test Sign-In

1. Click the Lexis extension icon
2. Go to **Settings**
3. Scroll to **Google Drive Storage & Sync**
4. Click **Connect Google Drive**
5. A popup window will open with Google sign-in
6. Sign in and grant permissions
7. You're connected!

## Common Issues

### Error: "The redirect URI in the request... does not match"

**Solution:**
- Double-check that the redirect URI in Google Cloud Console exactly matches: `https://YOUR_EXTENSION_ID.chromiumapp.org/`
- Make sure you're using the correct Extension ID from Edge
- There should be a trailing slash `/` at the end

### Error: "OAuth Client ID not configured"

**Solution:**
- Make sure you updated `manifest.json` with your actual Client ID
- The Client ID should NOT be `YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com`
- Reload the extension after updating manifest.json

### Sign-in popup closes immediately

**Solution:**
- Check that you added your email as a test user in OAuth consent screen
- Make sure Google Drive API is enabled
- Try opening browser console (F12) to see detailed errors

## Testing

After setup:
1. Sign in with Google Drive
2. Create a flashcard
3. Open browser console (F12)
4. You should see: "Sync completed: {success: true}"
5. Check your Google Drive → you should see "Lexis Extension Data" folder

## Why Web Application Instead of Chrome Extension?

- Chrome Extension OAuth type only works in Chrome
- Edge requires Web Application type with redirect URI
- The extension code automatically detects the browser and uses the correct OAuth flow
- Both authentication methods work with the same Client ID

## Need More Help?

See the full setup guide: [GOOGLE_DRIVE_SETUP.md](GOOGLE_DRIVE_SETUP.md)

## Quick Checklist

- [ ] Got Extension ID from `edge://extensions/`
- [ ] Created "Web application" OAuth client (not Chrome Extension)
- [ ] Added redirect URI: `https://YOUR_EXTENSION_ID.chromiumapp.org/`
- [ ] Updated Client ID in manifest.json
- [ ] Reloaded extension in Edge
- [ ] Added email as test user in OAuth consent screen
- [ ] Enabled Google Drive API in project
- [ ] Tested sign-in successfully
