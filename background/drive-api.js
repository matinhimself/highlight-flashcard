/**
 * Google Drive API Client for Lexis Extension
 * Handles authentication, file operations, and sync with Google Drive
 */

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3';
const FOLDER_NAME = 'Lexis Extension Data';
const FILES = {
  FLASHCARDS: 'flashcards.json',
  HIGHLIGHTS: 'highlights.json',
  SETTINGS: 'settings.json',
  METADATA: 'metadata.json'
};

class GoogleDriveClient {
  constructor() {
    this.token = null;
    this.folderId = null;
    this.fileCache = new Map(); // Cache file IDs
    this.syncInProgress = false;
    this.deviceId = null;
    this.initializeDeviceId();
  }

  /**
   * Initialize or retrieve unique device ID
   */
  async initializeDeviceId() {
    const stored = await chrome.storage.local.get(['deviceId']);
    if (stored.deviceId) {
      this.deviceId = stored.deviceId;
    } else {
      // Generate unique device ID
      this.deviceId = `device-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      await chrome.storage.local.set({ deviceId: this.deviceId });
    }
  }

  /**
   * Authenticate with Google using Chrome Identity API
   * @param {boolean} interactive - Whether to show login UI
   * @returns {Promise<string>} OAuth token
   */
  async authenticate(interactive = true) {
    return new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive }, (token) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (!token) {
          reject(new Error('No token received'));
          return;
        }
        this.token = token;
        resolve(token);
      });
    });
  }

  /**
   * Refresh the authentication token
   * @returns {Promise<string>} New OAuth token
   */
  async refreshToken() {
    if (!this.token) {
      return this.authenticate(false);
    }

    return new Promise((resolve, reject) => {
      chrome.identity.removeCachedAuthToken({ token: this.token }, async () => {
        try {
          const newToken = await this.authenticate(false);
          resolve(newToken);
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  /**
   * Sign out and revoke token
   */
  async signOut() {
    if (!this.token) return;

    return new Promise((resolve) => {
      chrome.identity.removeCachedAuthToken({ token: this.token }, () => {
        // Revoke token on Google's servers
        fetch(`https://accounts.google.com/o/oauth2/revoke?token=${this.token}`)
          .finally(() => {
            this.token = null;
            this.folderId = null;
            this.fileCache.clear();
            resolve();
          });
      });
    });
  }

  /**
   * Check if user is authenticated
   * @returns {Promise<boolean>}
   */
  async isAuthenticated() {
    try {
      await this.authenticate(false);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Make authenticated API request with retry logic
   * @param {string} url - API endpoint
   * @param {object} options - Fetch options
   * @param {number} retries - Number of retries left
   * @returns {Promise<Response>}
   */
  async makeRequest(url, options = {}, retries = 3) {
    if (!this.token) {
      await this.authenticate(false);
    }

    const headers = {
      'Authorization': `Bearer ${this.token}`,
      ...options.headers
    };

    try {
      const response = await fetch(url, { ...options, headers });

      // Handle 401 - Token expired
      if (response.status === 401 && retries > 0) {
        await this.refreshToken();
        return this.makeRequest(url, options, retries - 1);
      }

      // Handle 429 - Rate limit
      if (response.status === 429 && retries > 0) {
        const delay = Math.pow(2, 3 - retries) * 1000; // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.makeRequest(url, options, retries - 1);
      }

      // Handle other errors
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(`Drive API error: ${response.status} - ${error.error?.message || response.statusText}`);
      }

      return response;
    } catch (error) {
      // Network errors - retry with backoff
      if (retries > 0 && (error.name === 'TypeError' || error.message.includes('fetch'))) {
        const delay = Math.pow(2, 3 - retries) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.makeRequest(url, options, retries - 1);
      }
      throw error;
    }
  }

  /**
   * Get or create the app's folder in Google Drive
   * @returns {Promise<string>} Folder ID
   */
  async getOrCreateFolder() {
    if (this.folderId) {
      return this.folderId;
    }

    // Check if folder already exists
    const query = `name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    const searchUrl = `${DRIVE_API_BASE}/files?q=${encodeURIComponent(query)}&fields=files(id,name)`;

    const response = await this.makeRequest(searchUrl);
    const data = await response.json();

    if (data.files && data.files.length > 0) {
      this.folderId = data.files[0].id;
      return this.folderId;
    }

    // Create folder if it doesn't exist
    const createResponse = await this.makeRequest(`${DRIVE_API_BASE}/files`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: FOLDER_NAME,
        mimeType: 'application/vnd.google-apps.folder'
      })
    });

    const folder = await createResponse.json();
    this.folderId = folder.id;
    return this.folderId;
  }

  /**
   * Get file ID by name
   * @param {string} fileName - Name of the file
   * @returns {Promise<string|null>} File ID or null if not found
   */
  async getFileId(fileName) {
    // Check cache first
    if (this.fileCache.has(fileName)) {
      return this.fileCache.get(fileName);
    }

    const folderId = await this.getOrCreateFolder();
    const query = `name='${fileName}' and '${folderId}' in parents and trashed=false`;
    const searchUrl = `${DRIVE_API_BASE}/files?q=${encodeURIComponent(query)}&fields=files(id,name)`;

    const response = await this.makeRequest(searchUrl);
    const data = await response.json();

    if (data.files && data.files.length > 0) {
      const fileId = data.files[0].id;
      this.fileCache.set(fileName, fileId);
      return fileId;
    }

    return null;
  }

  /**
   * Upload a new file to Google Drive
   * @param {string} fileName - Name of the file
   * @param {object} content - File content (will be JSON stringified)
   * @returns {Promise<string>} File ID
   */
  async uploadFile(fileName, content) {
    const folderId = await this.getOrCreateFolder();

    const metadata = {
      name: fileName,
      mimeType: 'application/json',
      parents: [folderId]
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', new Blob([JSON.stringify(content, null, 2)], { type: 'application/json' }));

    const response = await this.makeRequest(
      `${DRIVE_UPLOAD_BASE}/files?uploadType=multipart&fields=id,name`,
      {
        method: 'POST',
        body: form
      }
    );

    const file = await response.json();
    this.fileCache.set(fileName, file.id);
    return file.id;
  }

  /**
   * Update an existing file in Google Drive
   * @param {string} fileId - ID of the file to update
   * @param {object} content - New file content
   * @returns {Promise<void>}
   */
  async updateFile(fileId, content) {
    await this.makeRequest(
      `${DRIVE_UPLOAD_BASE}/files/${fileId}?uploadType=media`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(content, null, 2)
      }
    );
  }

  /**
   * Download a file from Google Drive
   * @param {string} fileId - ID of the file to download
   * @returns {Promise<object>} Parsed JSON content
   */
  async downloadFile(fileId) {
    const response = await this.makeRequest(
      `${DRIVE_API_BASE}/files/${fileId}?alt=media`
    );
    return response.json();
  }

  /**
   * Upload or update a file (smart upload)
   * @param {string} fileName - Name of the file
   * @param {object} content - File content
   * @returns {Promise<string>} File ID
   */
  async saveFile(fileName, content) {
    const fileId = await this.getFileId(fileName);

    if (fileId) {
      await this.updateFile(fileId, content);
      return fileId;
    } else {
      return await this.uploadFile(fileName, content);
    }
  }

  /**
   * Download a file by name
   * @param {string} fileName - Name of the file
   * @returns {Promise<object|null>} Parsed JSON content or null if not found
   */
  async loadFile(fileName) {
    const fileId = await this.getFileId(fileName);
    if (!fileId) {
      return null;
    }
    return await this.downloadFile(fileId);
  }

  /**
   * Create file wrapper with metadata
   * @param {Array} items - Flashcards or highlights
   * @returns {object} File structure
   */
  createFileStructure(items) {
    return {
      version: '1.0',
      lastModified: Date.now(),
      deviceId: this.deviceId,
      items: items || []
    };
  }

  /**
   * Sync flashcards to Google Drive
   * @param {Array} flashcards - Local flashcards
   * @returns {Promise<void>}
   */
  async syncFlashcards(flashcards) {
    const fileContent = this.createFileStructure(flashcards);
    await this.saveFile(FILES.FLASHCARDS, fileContent);
  }

  /**
   * Load flashcards from Google Drive
   * @returns {Promise<Array>} Flashcards array
   */
  async loadFlashcards() {
    const file = await this.loadFile(FILES.FLASHCARDS);
    return file ? (file.items || []) : [];
  }

  /**
   * Sync highlights to Google Drive
   * @param {Array} highlights - Local highlights
   * @returns {Promise<void>}
   */
  async syncHighlights(highlights) {
    const fileContent = this.createFileStructure(highlights);
    await this.saveFile(FILES.HIGHLIGHTS, fileContent);
  }

  /**
   * Load highlights from Google Drive
   * @returns {Promise<Array>} Highlights array
   */
  async loadHighlights() {
    const file = await this.loadFile(FILES.HIGHLIGHTS);
    return file ? (file.items || []) : [];
  }

  /**
   * Merge local and remote data (last-write-wins strategy)
   * @param {Array} localItems - Local items
   * @param {Array} remoteItems - Remote items
   * @returns {Array} Merged items
   */
  mergeItems(localItems, remoteItems) {
    const merged = new Map();

    // Add all local items
    localItems.forEach(item => {
      merged.set(item.id, item);
    });

    // Merge remote items (last-write-wins)
    remoteItems.forEach(remoteItem => {
      const localItem = merged.get(remoteItem.id);

      if (!localItem) {
        // New item from remote
        merged.set(remoteItem.id, remoteItem);
      } else {
        // Conflict - compare timestamps
        const localTime = localItem.updatedAt || localItem.createdAt || 0;
        const remoteTime = remoteItem.updatedAt || remoteItem.createdAt || 0;

        if (remoteTime > localTime) {
          // Remote is newer
          merged.set(remoteItem.id, remoteItem);
        }
        // else: local is newer or equal, keep local
      }
    });

    return Array.from(merged.values());
  }

  /**
   * Perform full sync (download from Drive, merge, upload)
   * @param {object} localStorage - Local storage instance
   * @returns {Promise<object>} Sync result
   */
  async performFullSync(localStorage) {
    if (this.syncInProgress) {
      throw new Error('Sync already in progress');
    }

    this.syncInProgress = true;
    const syncResult = {
      success: false,
      flashcardsUpdated: false,
      highlightsUpdated: false,
      errors: []
    };

    try {
      // Get local data
      const localFlashcards = await localStorage.getAllFlashcards();
      const localHighlights = await localStorage.getAllHighlights();

      // Get remote data
      let remoteFlashcards = [];
      let remoteHighlights = [];

      try {
        remoteFlashcards = await this.loadFlashcards();
      } catch (error) {
        console.warn('Failed to load remote flashcards:', error);
        syncResult.errors.push('flashcards: ' + error.message);
      }

      try {
        remoteHighlights = await this.loadHighlights();
      } catch (error) {
        console.warn('Failed to load remote highlights:', error);
        syncResult.errors.push('highlights: ' + error.message);
      }

      // Merge data
      const mergedFlashcards = this.mergeItems(localFlashcards, remoteFlashcards);
      const mergedHighlights = this.mergeItems(localHighlights, remoteHighlights);

      // Check if data changed
      syncResult.flashcardsUpdated = JSON.stringify(localFlashcards) !== JSON.stringify(mergedFlashcards);
      syncResult.highlightsUpdated = JSON.stringify(localHighlights) !== JSON.stringify(mergedHighlights);

      // Update local storage if changed
      if (syncResult.flashcardsUpdated) {
        await localStorage.saveAllFlashcards(mergedFlashcards);
      }

      if (syncResult.highlightsUpdated) {
        await localStorage.saveAllHighlights(mergedHighlights);
      }

      // Upload merged data to Drive
      try {
        await this.syncFlashcards(mergedFlashcards);
      } catch (error) {
        console.error('Failed to sync flashcards to Drive:', error);
        syncResult.errors.push('upload flashcards: ' + error.message);
      }

      try {
        await this.syncHighlights(mergedHighlights);
      } catch (error) {
        console.error('Failed to sync highlights to Drive:', error);
        syncResult.errors.push('upload highlights: ' + error.message);
      }

      // Update metadata
      await chrome.storage.local.set({
        lastSyncTimestamp: Date.now(),
        syncEnabled: true
      });

      syncResult.success = syncResult.errors.length === 0;
      return syncResult;

    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Get user info (email, name)
   * @returns {Promise<object>} User info
   */
  async getUserInfo() {
    const response = await this.makeRequest('https://www.googleapis.com/oauth2/v2/userinfo');
    return response.json();
  }

  /**
   * Check sync status
   * @returns {Promise<object>} Sync status
   */
  async getSyncStatus() {
    const stored = await chrome.storage.local.get(['lastSyncTimestamp', 'syncEnabled']);
    return {
      enabled: stored.syncEnabled || false,
      lastSync: stored.lastSyncTimestamp || null,
      inProgress: this.syncInProgress
    };
  }
}

// Export as singleton
export const driveClient = new GoogleDriveClient();
