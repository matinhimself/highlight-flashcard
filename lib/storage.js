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
  useDefaultPrompt: true,
  useDefaultSchema: true,
  customSchema: '',
  useDefaultTemplate: true,
  customTemplate: '',
  useDefaultPreviewTemplate: true,
  previewTemplate: ''
};

// Default response schema
const DEFAULT_SCHEMA = {
  word: "string - the word or phrase",
  partOfSpeech: "string - part of speech (e.g., noun, verb)",
  definition: "string - brief definition (1 sentence)",
  example: "string - short example sentence"
};

// Default prompt template for flashcards (schema will be added dynamically via buildPromptWithSchema)
const DEFAULT_PROMPT = `You are a helpful dictionary assistant. Provide a brief, clear definition.

Keep it concise.`;

// Default markdown template for flashcard back
// Users can customize this with {{variable}} placeholders from the schema
const DEFAULT_TEMPLATE = `**{{word}}** *{{partOfSpeech}}*

{{definition}}

*{{example}}*`;

// Default preview template (for contextual toolbar preview)
const DEFAULT_PREVIEW_TEMPLATE = `### {{word}}

**Part of Speech:** {{partOfSpeech}}

**Definition:** {{definition}}

**Example:** *{{example}}*`;

// Default schema for describe prompts
const DEFAULT_DESCRIBE_SCHEMA = {
  summary: "string - concise summary of the content (1-2 sentences)",
  tags: "array of strings - relevant tags/keywords (comma-separated, 3-5 tags in the same domain as the content)"
};

// Default describe prompts
const DEFAULT_DESCRIBE_PROMPTS = [
  {
    id: 'software-engineer',
    name: 'Software Engineer',
    prompt: `You are an expert software engineer. Analyze and describe the following code or technical text in detail. Include:

1. **What it does**: Explain the purpose and functionality
2. **How it works**: Break down the logic and implementation
3. **Technical concepts**: Identify key programming concepts, patterns, or algorithms used
4. **Best practices**: Note any design patterns, anti-patterns, or optimization opportunities
5. **Context**: Explain where this might be used and why

Provide a clear, technical explanation suitable for software engineers. Use markdown for formatting.`,
    schema: DEFAULT_DESCRIBE_SCHEMA,
    useSchema: true,
    enabled: true,
    createdAt: Date.now()
  }
];

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

  /**
   * Get default schema
   * @returns {Object} Default schema
   */
  static getDefaultSchema() {
    return DEFAULT_SCHEMA;
  }

  /**
   * Get default template
   * @returns {string} Default template
   */
  static getDefaultTemplate() {
    return DEFAULT_TEMPLATE;
  }

  /**
   * Get default preview template
   * @returns {string} Default preview template
   */
  static getDefaultPreviewTemplate() {
    return DEFAULT_PREVIEW_TEMPLATE;
  }

  /**
   * Get default describe schema
   * @returns {Object} Default describe schema
   */
  static getDefaultDescribeSchema() {
    return DEFAULT_DESCRIBE_SCHEMA;
  }

  /**
   * Build prompt with schema instructions
   * @param {string} basePrompt - Base prompt text
   * @param {Object|string} schema - Schema object or JSON string
   * @returns {string} Prompt with schema
   */
  static buildPromptWithSchema(basePrompt, schema) {
    let schemaObj = schema;
    if (typeof schema === 'string') {
      try {
        schemaObj = JSON.parse(schema);
      } catch (error) {
        console.error('Invalid schema JSON:', error);
        schemaObj = DEFAULT_SCHEMA;
      }
    }

    const schemaString = JSON.stringify(schemaObj, null, 2);
    return `${basePrompt}

IMPORTANT: Respond with a valid JSON object matching this exact schema:
${schemaString}

Only return the JSON object, no additional text or markdown.`;
  }

  /**
   * Render template with data variables
   * @param {string} template - Template string with {{variable}} placeholders
   * @param {Object} data - Data object with variable values
   * @returns {string} Rendered template
   */
  static renderTemplate(template, data) {
    if (!template || !data) {
      return '';
    }

    let rendered = template;

    // Replace all {{variable}} placeholders with actual values
    for (const [key, value] of Object.entries(data)) {
      const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      const stringValue = value !== null && value !== undefined ? String(value) : '';
      rendered = rendered.replace(placeholder, stringValue);
    }

    // Remove any remaining unreplaced placeholders
    rendered = rendered.replace(/\{\{[^}]+\}\}/g, '');

    // Clean up empty markdown formatting
    // Remove lines that are just empty bold (**  **) or italic (*  *)
    rendered = rendered.replace(/^\*\*\s*\*\*\s*$/gm, '');
    rendered = rendered.replace(/^\*\s*\*\s*$/gm, '');

    // Remove lines with only markdown and whitespace
    rendered = rendered.replace(/^[\*_\s]+$/gm, '');

    // Clean up multiple consecutive empty lines (more than 2 newlines)
    rendered = rendered.replace(/\n{3,}/g, '\n\n');

    // Trim leading/trailing whitespace
    rendered = rendered.trim();

    return rendered;
  }

  // ============= DESCRIBE PROMPTS METHODS =============

  /**
   * Get all describe prompts
   * @returns {Promise<Array>} Array of describe prompts
   */
  static async getDescribePrompts() {
    try {
      const result = await chrome.storage.local.get('describePrompts');
      return result.describePrompts || DEFAULT_DESCRIBE_PROMPTS;
    } catch (error) {
      console.error('Error loading describe prompts:', error);
      return DEFAULT_DESCRIBE_PROMPTS;
    }
  }

  /**
   * Get enabled describe prompts
   * @returns {Promise<Array>} Array of enabled describe prompts
   */
  static async getEnabledDescribePrompts() {
    try {
      const prompts = await this.getDescribePrompts();
      return prompts.filter(p => p.enabled);
    } catch (error) {
      console.error('Error loading enabled describe prompts:', error);
      return [];
    }
  }

  /**
   * Add a new describe prompt
   * @param {Object} prompt - Prompt object
   * @returns {Promise<boolean>} Success status
   */
  static async addDescribePrompt(prompt) {
    try {
      const prompts = await this.getDescribePrompts();

      // Generate ID if not provided
      if (!prompt.id) {
        prompt.id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      }

      // Add timestamp if not provided
      if (!prompt.createdAt) {
        prompt.createdAt = Date.now();
      }

      // Set enabled to true by default
      if (prompt.enabled === undefined) {
        prompt.enabled = true;
      }

      prompts.push(prompt);
      await chrome.storage.local.set({ describePrompts: prompts });
      return true;
    } catch (error) {
      console.error('Error adding describe prompt:', error);
      return false;
    }
  }

  /**
   * Update a describe prompt
   * @param {string} id - Prompt ID
   * @param {Object} updates - Properties to update
   * @returns {Promise<boolean>} Success status
   */
  static async updateDescribePrompt(id, updates) {
    try {
      const prompts = await this.getDescribePrompts();
      const index = prompts.findIndex(p => p.id === id);

      if (index === -1) {
        console.error('Describe prompt not found:', id);
        return false;
      }

      prompts[index] = { ...prompts[index], ...updates };
      await chrome.storage.local.set({ describePrompts: prompts });
      return true;
    } catch (error) {
      console.error('Error updating describe prompt:', error);
      return false;
    }
  }

  /**
   * Delete a describe prompt
   * @param {string} id - Prompt ID
   * @returns {Promise<boolean>} Success status
   */
  static async deleteDescribePrompt(id) {
    try {
      const prompts = await this.getDescribePrompts();
      const filtered = prompts.filter(p => p.id !== id);

      if (filtered.length === prompts.length) {
        console.error('Describe prompt not found:', id);
        return false;
      }

      await chrome.storage.local.set({ describePrompts: filtered });
      return true;
    } catch (error) {
      console.error('Error deleting describe prompt:', error);
      return false;
    }
  }

  // ============= HIGHLIGHTS METHODS =============

  /**
   * Get all highlights
   * @returns {Promise<Array>} Array of highlights
   */
  static async getHighlights() {
    try {
      const result = await chrome.storage.local.get('highlights');
      return result.highlights || [];
    } catch (error) {
      console.error('Error loading highlights:', error);
      return [];
    }
  }

  /**
   * Add a new highlight
   * @param {Object} highlight - Highlight object
   * @returns {Promise<boolean>} Success status
   */
  static async addHighlight(highlight) {
    try {
      const highlights = await this.getHighlights();

      // Generate ID if not provided
      if (!highlight.id) {
        highlight.id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      }

      // Add timestamp if not provided
      if (!highlight.createdAt) {
        highlight.createdAt = Date.now();
      }

      highlights.unshift(highlight); // Add to beginning
      await chrome.storage.local.set({ highlights });
      return true;
    } catch (error) {
      console.error('Error adding highlight:', error);
      return false;
    }
  }

  /**
   * Update a highlight
   * @param {string} id - Highlight ID
   * @param {Object} updates - Properties to update
   * @returns {Promise<boolean>} Success status
   */
  static async updateHighlight(id, updates) {
    try {
      const highlights = await this.getHighlights();
      const index = highlights.findIndex(h => h.id === id);

      if (index === -1) {
        console.error('Highlight not found:', id);
        return false;
      }

      highlights[index] = { ...highlights[index], ...updates };
      await chrome.storage.local.set({ highlights });
      return true;
    } catch (error) {
      console.error('Error updating highlight:', error);
      return false;
    }
  }

  /**
   * Delete a highlight
   * @param {string} id - Highlight ID
   * @returns {Promise<boolean>} Success status
   */
  static async deleteHighlight(id) {
    try {
      const highlights = await this.getHighlights();
      const filtered = highlights.filter(h => h.id !== id);

      if (filtered.length === highlights.length) {
        console.error('Highlight not found:', id);
        return false;
      }

      await chrome.storage.local.set({ highlights: filtered });
      return true;
    } catch (error) {
      console.error('Error deleting highlight:', error);
      return false;
    }
  }

  /**
   * Search highlights by query
   * @param {string} query - Search query
   * @returns {Promise<Array>} Filtered highlights
   */
  static async searchHighlights(query) {
    try {
      const highlights = await this.getHighlights();

      if (!query || query.trim() === '') {
        return highlights;
      }

      const lowerQuery = query.toLowerCase();
      return highlights.filter(h => {
        // Search in text, description, URL, and title
        const matchesText = h.text.toLowerCase().includes(lowerQuery) ||
          (h.description && h.description.toLowerCase().includes(lowerQuery)) ||
          (h.sourceUrl && h.sourceUrl.toLowerCase().includes(lowerQuery)) ||
          (h.sourceTitle && h.sourceTitle.toLowerCase().includes(lowerQuery));

        // Search in tags
        const matchesTags = h.tags && h.tags.some(tag =>
          tag.toLowerCase().includes(lowerQuery)
        );

        return matchesText || matchesTags;
      });
    } catch (error) {
      console.error('Error searching highlights:', error);
      return [];
    }
  }

  /**
   * Delete all highlights
   * @returns {Promise<boolean>} Success status
   */
  static async clearAllHighlights() {
    try {
      await chrome.storage.local.set({ highlights: [] });
      return true;
    } catch (error) {
      console.error('Error clearing highlights:', error);
      return false;
    }
  }

  /**
   * Get all unique tags from highlights
   * @param {string} promptId - Optional prompt ID to filter tags by
   * @returns {Promise<Array>} Array of unique tag strings
   */
  static async getAllTags(promptId = null) {
    try {
      const highlights = await this.getHighlights();
      const tagSet = new Set();

      highlights.forEach(h => {
        // Filter by promptId if provided
        if (promptId && h.promptId !== promptId) {
          return;
        }

        // Add tags if they exist
        if (h.tags && Array.isArray(h.tags)) {
          h.tags.forEach(tag => {
            if (tag && tag.trim()) {
              tagSet.add(tag.trim());
            }
          });
        }
      });

      return Array.from(tagSet).sort();
    } catch (error) {
      console.error('Error getting tags:', error);
      return [];
    }
  }

  /**
   * Build prompt with schema for describe prompts (includes existing tags)
   * @param {string} basePrompt - Base prompt text
   * @param {Object|string} schema - Schema object or JSON string
   * @param {Array} existingTags - Array of existing tags to suggest
   * @returns {string} Prompt with schema
   */
  static buildDescribePromptWithSchema(basePrompt, schema, existingTags = []) {
    let schemaObj = schema;
    if (typeof schema === 'string') {
      try {
        schemaObj = JSON.parse(schema);
      } catch (error) {
        console.error('Invalid schema JSON:', error);
        schemaObj = DEFAULT_DESCRIBE_SCHEMA;
      }
    }

    const schemaString = JSON.stringify(schemaObj, null, 2);
    let prompt = `${basePrompt}

IMPORTANT: Respond with a valid JSON object matching this exact schema:
${schemaString}

Only return the JSON object, no additional text or markdown.`;

    // Add existing tags suggestion if available
    if (existingTags && existingTags.length > 0) {
      const tagsList = existingTags.slice(0, 50).join(', '); // Limit to 50 tags
      prompt += `

NOTE: When generating tags, prefer using tags from this existing list when relevant: ${tagsList}`;
    }

    return prompt;
  }

  // ===========================
  // Google Drive Sync Methods
  // ===========================

  /**
   * Get all flashcards (alias for sync compatibility)
   * @returns {Promise<Array>} Array of flashcards
   */
  static async getAllFlashcards() {
    return this.getFlashcards();
  }

  /**
   * Save all flashcards (for sync operations)
   * @param {Array} flashcards - Array of flashcards
   * @returns {Promise<boolean>} Success status
   */
  static async saveAllFlashcards(flashcards) {
    try {
      await chrome.storage.local.set({ flashcards });
      return true;
    } catch (error) {
      console.error('Error saving all flashcards:', error);
      return false;
    }
  }

  /**
   * Get all highlights (alias for sync compatibility)
   * @returns {Promise<Array>} Array of highlights
   */
  static async getAllHighlights() {
    try {
      const result = await chrome.storage.local.get('highlights');
      return result.highlights || [];
    } catch (error) {
      console.error('Error loading highlights:', error);
      return [];
    }
  }

  /**
   * Save all highlights (for sync operations)
   * @param {Array} highlights - Array of highlights
   * @returns {Promise<boolean>} Success status
   */
  static async saveAllHighlights(highlights) {
    try {
      await chrome.storage.local.set({ highlights });
      return true;
    } catch (error) {
      console.error('Error saving all highlights:', error);
      return false;
    }
  }

  /**
   * Queue a sync operation (debounced)
   * @returns {Promise<void>}
   */
  static async queueSync() {
    // Check if Google Drive is enabled
    const config = await chrome.storage.local.get(['googleDriveEnabled']);
    if (!config.googleDriveEnabled) {
      return; // Sync disabled
    }

    // Send message to background script to perform sync
    chrome.runtime.sendMessage({ type: 'QUEUE_SYNC' });
  }

  /**
   * Trigger immediate sync
   * @returns {Promise<object>} Sync result
   */
  static async syncNow() {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type: 'SYNC_NOW' }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
  }

  /**
   * Get sync status
   * @returns {Promise<object>} Sync status
   */
  static async getSyncStatus() {
    const stored = await chrome.storage.local.get([
      'lastSyncTimestamp',
      'googleDriveEnabled',
      'googleDriveUser'
    ]);

    return {
      enabled: stored.googleDriveEnabled || false,
      lastSync: stored.lastSyncTimestamp || null,
      user: stored.googleDriveUser || null
    };
  }

  /**
   * Override add flashcard to trigger sync
   */
  static async addFlashcardWithSync(flashcard) {
    const success = await this.addFlashcard(flashcard);
    if (success) {
      await this.queueSync();
    }
    return success;
  }

  /**
   * Override update flashcard to trigger sync
   */
  static async updateFlashcardWithSync(id, updates) {
    // Add updatedAt timestamp
    updates.updatedAt = Date.now();
    const success = await this.updateFlashcard(id, updates);
    if (success) {
      await this.queueSync();
    }
    return success;
  }

  /**
   * Override delete flashcard to trigger sync
   */
  static async deleteFlashcardWithSync(id) {
    const success = await this.deleteFlashcard(id);
    if (success) {
      await this.queueSync();
    }
    return success;
  }

  /**
   * Override add highlight to trigger sync
   */
  static async addHighlightWithSync(highlight) {
    const success = await this.addHighlight(highlight);
    if (success) {
      await this.queueSync();
    }
    return success;
  }

  /**
   * Override update highlight to trigger sync
   */
  static async updateHighlightWithSync(id, updates) {
    // Add updatedAt timestamp
    updates.updatedAt = Date.now();
    const success = await this.updateHighlight(id, updates);
    if (success) {
      await this.queueSync();
    }
    return success;
  }

  /**
   * Override delete highlight to trigger sync
   */
  static async deleteHighlightWithSync(id) {
    const success = await this.deleteHighlight(id);
    if (success) {
      await this.queueSync();
    }
    return success;
  }
}

// Export for use in other modules
export default Storage;
