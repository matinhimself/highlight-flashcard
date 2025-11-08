/**
 * OpenRouter API integration for Highlight Flashcard Extension
 * Handles all communication with OpenRouter API
 */

// Available models
export const AVAILABLE_MODELS = [
  { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet (Recommended)', provider: 'Anthropic' },
  { id: 'anthropic/claude-3-haiku', name: 'Claude 3 Haiku (Faster, Cheaper)', provider: 'Anthropic' },
  { id: 'openai/gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'OpenAI' },
  { id: 'openai/gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'OpenAI' },
  { id: 'x-ai/grok-beta', name: 'Grok Beta (Fast)', provider: 'xAI' },
  { id: 'meta-llama/llama-3.1-8b-instruct', name: 'Llama 3.1 8B', provider: 'Meta' },
  { id: 'google/gemini-pro', name: 'Gemini Pro', provider: 'Google' }
];

/**
 * OpenRouter API client
 */
class OpenRouterClient {
  constructor(apiKey, model = 'anthropic/claude-3.5-sonnet') {
    this.apiKey = apiKey;
    this.model = model;
    this.baseUrl = 'https://openrouter.ai/api/v1';
    this.maxRetries = 3;
    this.retryDelay = 1000; // 1 second base delay
  }

  /**
   * Create a definition for a word or phrase
   * @param {string} word - The word or phrase to define
   * @param {string} prompt - The prompt template to use
   * @returns {Promise<Object>} Result object with success status and definition or error
   */
  async createDefinition(word, prompt) {
    if (!this.apiKey) {
      return {
        success: false,
        error: 'API key not configured'
      };
    }

    if (!word || word.trim() === '') {
      return {
        success: false,
        error: 'No word provided'
      };
    }

    // Truncate if too long
    const truncatedWord = word.length > 500 ? word.substring(0, 500) : word;

    try {
      const response = await this._makeRequest({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: prompt
          },
          {
            role: 'user',
            content: truncatedWord
          }
        ],
        temperature: 0.7,
        max_tokens: 500
      });

      if (!response.choices || response.choices.length === 0) {
        return {
          success: false,
          error: 'Empty response from API'
        };
      }

      const definition = response.choices[0].message.content.trim();

      if (!definition) {
        return {
          success: false,
          error: 'Empty definition received'
        };
      }

      return {
        success: true,
        definition,
        usage: response.usage
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Test API connection with a simple request
   * @returns {Promise<Object>} Result object with success status
   */
  async testConnection() {
    if (!this.apiKey) {
      return {
        success: false,
        error: 'API key not provided'
      };
    }

    try {
      await this._makeRequest({
        model: this.model,
        messages: [
          {
            role: 'user',
            content: 'test'
          }
        ],
        max_tokens: 5
      });

      return {
        success: true
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Make a request to OpenRouter API with retry logic
   * @param {Object} body - Request body
   * @param {number} retryCount - Current retry attempt
   * @returns {Promise<Object>} API response
   * @private
   */
  async _makeRequest(body, retryCount = 0) {
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': chrome.runtime.getURL(''),
          'X-Title': 'Highlight Flashcard Extension'
        },
        body: JSON.stringify(body)
      });

      // Handle non-OK responses
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(this._getErrorMessage(response.status, errorData));
      }

      return await response.json();
    } catch (error) {
      // Retry logic for network errors
      if (retryCount < this.maxRetries && this._isRetryableError(error)) {
        const delay = this.retryDelay * Math.pow(2, retryCount);
        console.log(`Retrying request in ${delay}ms (attempt ${retryCount + 1}/${this.maxRetries})`);

        await new Promise(resolve => setTimeout(resolve, delay));
        return this._makeRequest(body, retryCount + 1);
      }

      throw error;
    }
  }

  /**
   * Get human-readable error message for status code
   * @param {number} status - HTTP status code
   * @param {Object} errorData - Error data from response
   * @returns {string} Error message
   * @private
   */
  _getErrorMessage(status, errorData) {
    const errorMessage = errorData.error?.message || '';

    switch (status) {
      case 400:
        return `Bad request: ${errorMessage || 'Invalid parameters'}`;
      case 401:
        return 'Invalid API key. Please update in settings.';
      case 402:
        return 'Insufficient credits. Please check your OpenRouter account.';
      case 429:
        return 'Rate limit reached. Please try again later.';
      case 500:
      case 503:
        return 'Server error. Please try again later.';
      default:
        return errorMessage || `API error (${status})`;
    }
  }

  /**
   * Check if error is retryable
   * @param {Error} error - Error object
   * @returns {boolean} Whether error is retryable
   * @private
   */
  _isRetryableError(error) {
    // Retry on network errors but not on client errors (4xx)
    if (error.message.includes('Invalid API key')) return false;
    if (error.message.includes('Insufficient credits')) return false;
    if (error.message.includes('Bad request')) return false;

    return true;
  }

  /**
   * Get list of available models
   * @static
   * @returns {Array} List of model objects
   */
  static getAvailableModels() {
    return AVAILABLE_MODELS;
  }
}

export default OpenRouterClient;
