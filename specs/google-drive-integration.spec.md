# Google Drive Storage Integration Specification

## Overview
Integrate Google Drive as the primary cloud storage solution for the Lexis extension, enabling users to store flashcards and highlights as structured JSON files in their personal Google Drive. This will enable cross-device sync, data backup, and data portability.

## Goals
1. Enable users to authenticate with Google OAuth 2.0
2. Store flashcards and highlights as JSON files in Google Drive
3. Sync data across devices where the extension is installed
4. Provide a login page for Google authentication
5. Maintain backward compatibility with local storage
6. Enable data migration from local storage to Google Drive

## Technical Architecture

### 1. Authentication Flow

#### OAuth 2.0 with Chrome Identity API
Chrome extensions have special support for OAuth 2.0 through the `chrome.identity` API:

```javascript
// manifest.json permissions required
{
  "permissions": [
    "identity"
  ],
  "oauth2": {
    "client_id": "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com",
    "scopes": [
      "https://www.googleapis.com/auth/drive.file",
      "https://www.googleapis.com/auth/drive.appdata"
    ]
  }
}
```

**Scopes Explained:**
- `drive.file`: Access to files created by the app only (recommended)
- `drive.appdata`: Access to app-specific hidden folder (alternative for settings)

**Authentication Steps:**
1. User clicks "Sign in with Google" button
2. Extension calls `chrome.identity.launchWebAuthFlow()` or `chrome.identity.getAuthToken()`
3. Google OAuth consent screen opens in new window
4. User grants permissions
5. Extension receives OAuth token
6. Token stored securely in `chrome.storage.local` with encryption
7. Token used for all Google Drive API requests

#### Token Management
- Access tokens expire after 1 hour
- Use `chrome.identity.removeCachedAuthToken()` + `getAuthToken()` for refresh
- Implement automatic token refresh on 401 errors
- Handle revocation gracefully (re-auth prompt)

### 2. File Storage Structure

#### Drive Folder Structure
```
Google Drive Root
└── Lexis Extension Data/          # User-visible folder
    ├── flashcards.json            # All flashcards
    ├── highlights.json            # All highlights
    ├── settings.json              # Extension settings (excluding API keys)
    └── metadata.json              # Sync metadata
```

**Alternative: Hidden AppData Folder**
```
Google Drive AppData (hidden)      # Not visible to user in Drive UI
├── flashcards.json
├── highlights.json
├── settings.json
└── metadata.json
```

**Recommendation:** Use visible folder approach for transparency and user control.

#### File Format Specification

**flashcards.json:**
```json
{
  "version": "1.0",
  "lastModified": 1699564821234,
  "deviceId": "extension-instance-uuid",
  "flashcards": [
    {
      "id": "1699564821234-abc123",
      "word": "ephemeral",
      "definition": "...",
      "data": { /* structured data */ },
      "sourceUrl": "https://example.com",
      "model": "anthropic/claude-3.5-sonnet",
      "createdAt": 1699564821234,
      "updatedAt": 1699564821234,
      "deletedAt": null
    }
  ]
}
```

**highlights.json:**
```json
{
  "version": "1.0",
  "lastModified": 1699564821234,
  "deviceId": "extension-instance-uuid",
  "highlights": [
    {
      "id": "1699564821234-abc123",
      "text": "Selected text",
      "description": "AI summary",
      "tags": ["tag1", "tag2"],
      "sourceUrl": "https://example.com",
      "createdAt": 1699564821234,
      "updatedAt": 1699564821234,
      "deletedAt": null
    }
  ]
}
```

**metadata.json:**
```json
{
  "version": "1.0",
  "deviceId": "extension-instance-uuid",
  "lastSyncTimestamp": 1699564821234,
  "conflictResolutionStrategy": "last-write-wins"
}
```

### 3. Sync Strategy

#### Sync Triggers
1. **On startup:** Sync when extension loads
2. **On create/update/delete:** Immediate sync after local changes
3. **Periodic sync:** Every 5 minutes if changes detected
4. **Manual sync:** User-triggered from settings

#### Conflict Resolution: Last-Write-Wins
- Compare `lastModified` timestamps
- Most recent change wins
- Use `deviceId` as tiebreaker if timestamps match
- Show notification if conflicts resolved automatically

#### Sync Algorithm
```
1. Fetch metadata.json from Drive
2. Compare lastSyncTimestamp with local timestamp
3. If Drive newer:
   - Download flashcards.json and highlights.json
   - Merge with local data (last-write-wins per item)
   - Update local storage
4. If local newer:
   - Upload flashcards.json and highlights.json
   - Update Drive files
5. Update metadata.json with current timestamp
6. Update local lastSyncTimestamp
```

#### Soft Deletes
- Don't permanently delete items
- Set `deletedAt` timestamp instead
- Filter out deleted items in UI
- Permanent cleanup after 30 days (configurable)

### 4. Google Drive API Integration

#### API Client Architecture

Create new file: `background/drive-api.js`

```javascript
class GoogleDriveClient {
  constructor() {
    this.token = null;
    this.folderId = null;
    this.fileCache = new Map(); // file ID cache
  }

  // Authentication
  async authenticate() { /* ... */ }
  async refreshToken() { /* ... */ }
  async signOut() { /* ... */ }

  // Folder operations
  async getOrCreateFolder(folderName) { /* ... */ }

  // File operations
  async uploadFile(fileName, content, mimeType) { /* ... */ }
  async updateFile(fileId, content) { /* ... */ }
  async downloadFile(fileId) { /* ... */ }
  async listFiles(query) { /* ... */ }
  async deleteFile(fileId) { /* ... */ }

  // High-level operations
  async syncFlashcards(localData) { /* ... */ }
  async syncHighlights(localData) { /* ... */ }
  async performFullSync() { /* ... */ }
}
```

#### API Endpoints Used
- **Upload:** `POST https://www.googleapis.com/upload/drive/v3/files`
- **Update:** `PATCH https://www.googleapis.com/upload/drive/v3/files/{fileId}`
- **Download:** `GET https://www.googleapis.com/drive/v3/files/{fileId}?alt=media`
- **List:** `GET https://www.googleapis.com/drive/v3/files?q={query}`
- **Delete:** `DELETE https://www.googleapis.com/drive/v3/files/{fileId}`

#### Error Handling
- Network errors: Retry with exponential backoff (3 attempts)
- 401 Unauthorized: Refresh token and retry
- 403 Forbidden: Check scopes, prompt re-auth
- 404 Not Found: Recreate file/folder
- 429 Rate Limit: Exponential backoff (up to 32 seconds)
- Quota exceeded: Notify user

### 5. Storage Abstraction Layer

#### Update `lib/storage.js`

Add storage backend abstraction:

```javascript
class StorageBackend {
  async getFlashcards() { throw new Error('Not implemented'); }
  async saveFlashcard(flashcard) { throw new Error('Not implemented'); }
  // ... other methods
}

class LocalStorageBackend extends StorageBackend {
  // Current implementation using chrome.storage.local
}

class GoogleDriveStorageBackend extends StorageBackend {
  constructor(driveClient) {
    super();
    this.driveClient = driveClient;
    this.syncInProgress = false;
  }

  async getFlashcards() {
    // Return cached local copy
    // Trigger background sync if needed
  }

  async saveFlashcard(flashcard) {
    // Save to local cache immediately
    // Queue sync operation
  }
}

class HybridStorageBackend extends StorageBackend {
  // Uses local storage with Google Drive sync
  // Best of both worlds: fast reads, cloud backup
}
```

**Recommendation:** Use `HybridStorageBackend` for best UX.

### 6. UI Components

#### Login Page (New)

Create: `ui/login.html`, `ui/login.js`, `ui/login.css`

**Features:**
- Google Sign-In button (official Google branding)
- Explanation of permissions required
- Privacy notice (data stored in user's Drive only)
- "Continue without sign-in" option (use local storage)

**Login Flow:**
1. Extension installed → Check if authenticated
2. If not authenticated → Show login page on first popup open
3. User clicks "Sign in with Google"
4. OAuth flow completes
5. Initial sync from Drive (if data exists) or migrate local data
6. Redirect to popup/flashcards page

#### Settings Page Updates

Add section: "Storage & Sync"

**Settings:**
- Current account (email, avatar)
- Sign out button
- Storage mode: "Google Drive" or "Local Only"
- Last sync timestamp
- Manual sync button
- "Export local data to Drive" button (migration)
- "Delete all cloud data" button (with confirmation)

**Sync Status Indicator:**
- Green checkmark: Synced
- Orange spinner: Syncing...
- Red X: Sync error (with details)

#### Popup Updates

Add sync status icon:
- Small icon in header showing sync status
- Click to view last sync time
- Visual feedback during sync

### 7. Migration Strategy

#### First-Time Setup

**Scenario A: New User (No Local Data)**
1. User installs extension
2. Prompted to sign in with Google
3. Extension checks Drive for existing data
4. If found: Download and use
5. If not: Start fresh with Drive storage

**Scenario B: Existing User (Has Local Data)**
1. User signs in with Google
2. Extension detects local data
3. Show migration dialog:
   - "We found X flashcards and Y highlights on this device"
   - "Upload to Google Drive? (Recommended)"
   - Options: [Upload] [Keep Local Only] [Cancel]
4. If Upload:
   - Check Drive for existing data
   - If Drive has data: Show merge options
   - Upload local data to Drive
   - Mark migration complete

**Scenario C: Multi-Device Sync**
1. User signs in on second device
2. Extension downloads data from Drive
3. Merges with any local data (if exists)
4. Keeps devices in sync

#### Data Migration Process
```javascript
async function migrateLocalToDrive() {
  // 1. Get all local flashcards and highlights
  const localFlashcards = await storage.getAllFlashcards();
  const localHighlights = await storage.getAllHighlights();

  // 2. Check if Drive already has data
  const driveFlashcards = await driveClient.downloadFlashcards();
  const driveHighlights = await driveClient.downloadHighlights();

  // 3. Merge (last-write-wins)
  const mergedFlashcards = mergeData(localFlashcards, driveFlashcards);
  const mergedHighlights = mergeData(localHighlights, driveHighlights);

  // 4. Upload to Drive
  await driveClient.uploadFlashcards(mergedFlashcards);
  await driveClient.uploadHighlights(mergedHighlights);

  // 5. Update local storage
  await storage.saveAllFlashcards(mergedFlashcards);
  await storage.saveAllHighlights(mergedHighlights);

  // 6. Mark migration complete
  await storage.setMigrationComplete(true);
}
```

### 8. Security & Privacy Considerations

#### Security Measures
1. **Token Storage:** Store OAuth tokens encrypted in local storage
2. **API Keys:** Keep OpenRouter API keys local only (DO NOT sync to Drive)
3. **HTTPS Only:** All API requests over HTTPS
4. **Minimal Scopes:** Only request `drive.file` scope (not full Drive access)
5. **Token Expiry:** Implement proper token refresh logic
6. **No Server:** Direct client-to-Drive communication (no intermediary)

#### Privacy Features
1. **User Control:** User owns all data (stored in their Drive)
2. **No Tracking:** No analytics on user data
3. **Transparent Storage:** Files visible in Drive (not hidden)
4. **Easy Export:** Standard JSON format for portability
5. **Right to Delete:** User can delete Drive folder anytime

#### Data Not Synced (Kept Local Only)
- OpenRouter API keys (security risk if synced)
- Extension internal state (not needed across devices)
- Temporary data/cache

### 9. Performance Considerations

#### Optimization Strategies
1. **Local Cache:** Keep local copy of Drive data for instant reads
2. **Lazy Sync:** Don't block UI during sync operations
3. **Batch Updates:** Batch multiple changes into single Drive update
4. **Debounce Sync:** Wait 2 seconds after last change before syncing
5. **Compression:** Gzip JSON before upload (if >100KB)
6. **Incremental Sync:** Only sync changed items (future enhancement)

#### Handling Large Datasets
- Drive API file size limit: 5TB (far more than needed)
- Estimated capacity: 100,000+ flashcards in single file
- If file size exceeds 10MB: Consider splitting into chunks
- Implement pagination for UI (already done for highlights)

### 10. Error Scenarios & Recovery

#### Common Errors & Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| 401 Unauthorized | Token expired | Auto-refresh token, retry |
| 403 Forbidden | Insufficient permissions | Prompt re-authentication |
| 404 Not Found | File deleted manually | Recreate file with current data |
| 429 Too Many Requests | Rate limit hit | Exponential backoff, retry |
| Network timeout | Poor connection | Retry with backoff, show offline mode |
| Conflict detected | Simultaneous edits | Last-write-wins, notify user |
| File corrupted | Invalid JSON | Restore from local backup, notify user |

#### Offline Mode
- Allow full read/write when offline
- Queue sync operations
- Sync when connection restored
- Show offline indicator in UI

### 11. Testing Strategy

#### Unit Tests
- Storage abstraction layer
- Sync algorithm (merge logic)
- Conflict resolution
- Token refresh logic

#### Integration Tests
- OAuth flow (with test account)
- File upload/download
- Full sync cycle
- Migration from local to Drive

#### Manual Testing Checklist
- [ ] Install fresh extension → Sign in → Creates Drive folder
- [ ] Create flashcard → Syncs to Drive
- [ ] Sign in on second device → Data syncs correctly
- [ ] Edit same flashcard on two devices → Conflict resolves
- [ ] Sign out → Data still accessible locally
- [ ] Delete Drive file manually → Extension recreates
- [ ] Revoke permissions → Extension handles gracefully
- [ ] Poor network → Offline mode works

### 12. Implementation Phases

#### Phase 1: Core Authentication (Week 1)
- [ ] Set up Google Cloud project and OAuth credentials
- [ ] Implement `chrome.identity` authentication flow
- [ ] Create login page UI
- [ ] Implement token management and refresh

#### Phase 2: Drive API Integration (Week 1-2)
- [ ] Implement GoogleDriveClient class
- [ ] Folder creation and file operations
- [ ] Upload/download JSON files
- [ ] Error handling and retry logic

#### Phase 3: Storage Abstraction (Week 2)
- [ ] Refactor storage.js with backend abstraction
- [ ] Implement HybridStorageBackend
- [ ] Implement sync algorithm
- [ ] Add conflict resolution

#### Phase 4: UI Updates (Week 2-3)
- [ ] Update settings page with sync controls
- [ ] Add sync status indicators
- [ ] Implement migration dialog
- [ ] Add manual sync button

#### Phase 5: Testing & Polish (Week 3)
- [ ] End-to-end testing
- [ ] Multi-device testing
- [ ] Error scenario testing
- [ ] Performance optimization
- [ ] Documentation updates

## API Reference

### Chrome Identity API
```javascript
// Get OAuth token
chrome.identity.getAuthToken({ interactive: true }, (token) => {
  if (chrome.runtime.lastError) {
    console.error(chrome.runtime.lastError);
    return;
  }
  // Use token for Drive API
});

// Remove cached token (for refresh)
chrome.identity.removeCachedAuthToken({ token: oldToken }, () => {
  // Get new token
});

// Revoke token (sign out)
chrome.identity.removeCachedAuthToken({ token: token }, () => {
  fetch(`https://accounts.google.com/o/oauth2/revoke?token=${token}`);
});
```

### Google Drive API v3
```javascript
// Create folder
POST https://www.googleapis.com/drive/v3/files
Content-Type: application/json
Authorization: Bearer {token}

{
  "name": "Lexis Extension Data",
  "mimeType": "application/vnd.google-apps.folder"
}

// Upload file
POST https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart
Authorization: Bearer {token}

// Update file
PATCH https://www.googleapis.com/upload/drive/v3/files/{fileId}?uploadType=media
Authorization: Bearer {token}
Content-Type: application/json

{file content}

// Download file
GET https://www.googleapis.com/drive/v3/files/{fileId}?alt=media
Authorization: Bearer {token}

// List files
GET https://www.googleapis.com/drive/v3/files?q=name='flashcards.json' and '{folderId}' in parents
Authorization: Bearer {token}
```

## Configuration

### manifest.json Updates
```json
{
  "manifest_version": 3,
  "permissions": [
    "storage",
    "contextMenus",
    "notifications",
    "identity"
  ],
  "oauth2": {
    "client_id": "YOUR_CLIENT_ID.apps.googleusercontent.com",
    "scopes": [
      "https://www.googleapis.com/auth/drive.file"
    ]
  },
  "host_permissions": [
    "https://www.googleapis.com/*"
  ]
}
```

### Google Cloud Console Setup
1. Create new project: "Lexis Extension"
2. Enable Google Drive API
3. Configure OAuth consent screen:
   - App name: "Lexis - AI Flashcards"
   - Scopes: `drive.file`
   - Test users (during development)
4. Create OAuth 2.0 Client ID:
   - Application type: Chrome Extension
   - Extension ID: (get from Chrome Web Store Developer Dashboard)
5. Copy Client ID to manifest.json

## Future Enhancements

### Version 2.0 Features
- [ ] Incremental sync (only changed items)
- [ ] Conflict resolution UI (manual merge)
- [ ] Multiple Drive accounts support
- [ ] Shared folders (collaborate on flashcard decks)
- [ ] Version history (restore previous versions)
- [ ] Advanced search across Drive files
- [ ] Drive folder selection (custom location)
- [ ] Import from other flashcard apps

### Alternative Storage Options
- **Google Sheets:** Store flashcards as spreadsheet (easier manual editing)
- **Firestore:** Real-time sync, better for collaboration
- **Self-hosted:** Sync with personal server

## Conclusion

This specification provides a comprehensive plan for integrating Google Drive storage into the Lexis extension. The hybrid approach (local cache + cloud sync) ensures fast performance while enabling cross-device sync and data backup. The implementation prioritizes user privacy, security, and data portability while maintaining backward compatibility with existing local storage.
