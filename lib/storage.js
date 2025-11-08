/**
 * Storage abstraction layer for Highlight Flashcard Extension
 * Provides consistent interface for browser storage operations
 */

// Default settings
const DEFAULT_SETTINGS = {
  apiKey: '',
  selectedModel: 'anthropic/claude-3.5-sonnet',
  useCustomModel: false,
  customModelId: '',
  customPrompt: '',
  useDefaultPrompt: true
};

// Default prompt template
const DEFAULT_PROMPT = `You are a helpful English dictionary assistant. Provide a clear, concise definition for the following word or phrase. Include:

1. Part of speech
2. Definition (one or two sentences)
3. Example sentence using the word in context

Format your response in a clear, easy-to-understand manner suitable for a flashcard. Use markdown for formatting.`;

/**
 * Storage class for managing extension data
 */
class Storage {
  /**
   * Get current settings
   * @returns {Promise<Object>} Settings object
   */
  static async getSettings() {
    try {
      const result = await chrome.storage.local.get('settings');
      return result.settings || DEFAULT_SETTINGS;
    } catch (error) {
      console.error('Error loading settings:', error);
      return DEFAULT_SETTINGS;
    }
  }

  /**
   * Save settings
   * @param {Object} settings - Settings object to save
   * @returns {Promise<boolean>} Success status
   */
  static async saveSettings(settings) {
    try {
      await chrome.storage.local.set({ settings });
      return true;
    } catch (error) {
      console.error('Error saving settings:', error);
      return false;
    }
  }

  /**
   * Get all flashcards
   * @returns {Promise<Array>} Array of flashcards
   */
  static async getFlashcards() {
    try {
      const result = await chrome.storage.local.get('flashcards');
      return result.flashcards || [];
    } catch (error) {
      console.error('Error loading flashcards:', error);
      return [];
    }
  }

  /**
   * Get a single flashcard by ID
   * @param {string} id - Flashcard ID
   * @returns {Promise<Object|null>} Flashcard object or null
   */
  static async getFlashcard(id) {
    try {
      const flashcards = await this.getFlashcards();
      return flashcards.find(card => card.id === id) || null;
    } catch (error) {
      console.error('Error getting flashcard:', error);
      return null;
    }
  }

  /**
   * Add a new flashcard
   * @param {Object} flashcard - Flashcard object
   * @returns {Promise<boolean>} Success status
   */
  static async addFlashcard(flashcard) {
    try {
      const flashcards = await this.getFlashcards();

      // Generate ID if not provided
      if (!flashcard.id) {
        flashcard.id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      }

      // Add timestamp if not provided
      if (!flashcard.createdAt) {
        flashcard.createdAt = Date.now();
      }

      flashcards.unshift(flashcard); // Add to beginning
      await chrome.storage.local.set({ flashcards });
      return true;
    } catch (error) {
      console.error('Error adding flashcard:', error);
      return false;
    }
  }

  /**
   * Update an existing flashcard
   * @param {string} id - Flashcard ID
   * @param {Object} updates - Properties to update
   * @returns {Promise<boolean>} Success status
   */
  static async updateFlashcard(id, updates) {
    try {
      const flashcards = await this.getFlashcards();
      const index = flashcards.findIndex(card => card.id === id);

      if (index === -1) {
        console.error('Flashcard not found:', id);
        return false;
      }

      flashcards[index] = { ...flashcards[index], ...updates };
      await chrome.storage.local.set({ flashcards });
      return true;
    } catch (error) {
      console.error('Error updating flashcard:', error);
      return false;
    }
  }

  /**
   * Delete a flashcard
   * @param {string} id - Flashcard ID
   * @returns {Promise<boolean>} Success status
   */
  static async deleteFlashcard(id) {
    try {
      const flashcards = await this.getFlashcards();
      const filtered = flashcards.filter(card => card.id !== id);

      if (filtered.length === flashcards.length) {
        console.error('Flashcard not found:', id);
        return false;
      }

      await chrome.storage.local.set({ flashcards: filtered });
      return true;
    } catch (error) {
      console.error('Error deleting flashcard:', error);
      return false;
    }
  }

  /**
   * Delete all flashcards
   * @returns {Promise<boolean>} Success status
   */
  static async clearAllFlashcards() {
    try {
      await chrome.storage.local.set({ flashcards: [] });
      return true;
    } catch (error) {
      console.error('Error clearing flashcards:', error);
      return false;
    }
  }

  /**
   * Search flashcards by query
   * @param {string} query - Search query
   * @returns {Promise<Array>} Filtered flashcards
   */
  static async searchFlashcards(query) {
    try {
      const flashcards = await this.getFlashcards();

      if (!query || query.trim() === '') {
        return flashcards;
      }

      const lowerQuery = query.toLowerCase();
      return flashcards.filter(card =>
        card.word.toLowerCase().includes(lowerQuery) ||
        card.definition.toLowerCase().includes(lowerQuery) ||
        (card.sourceUrl && card.sourceUrl.toLowerCase().includes(lowerQuery))
      );
    } catch (error) {
      console.error('Error searching flashcards:', error);
      return [];
    }
  }

  /**
   * Get storage usage statistics
   * @returns {Promise<Object>} Storage stats
   */
  static async getStorageStats() {
    try {
      const bytes = await chrome.storage.local.getBytesInUse();
      const flashcards = await this.getFlashcards();

      return {
        bytesUsed: bytes,
        bytesTotal: 5242880, // 5MB limit
        percentUsed: (bytes / 5242880) * 100,
        flashcardCount: flashcards.length
      };
    } catch (error) {
      console.error('Error getting storage stats:', error);
      return {
        bytesUsed: 0,
        bytesTotal: 5242880,
        percentUsed: 0,
        flashcardCount: 0
      };
    }
  }

  /**
   * Get default prompt template
   * @returns {string} Default prompt
   */
  static getDefaultPrompt() {
    return DEFAULT_PROMPT;
  }
}

// Export for use in other modules
export default Storage;
