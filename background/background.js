/**
 * Background service worker for Highlight Flashcard Extension
 * Handles context menu creation and flashcard generation
 */

import Storage from '../lib/storage.js';
import OpenRouterClient from './api.js';

// Context menu ID
const CONTEXT_MENU_ID = 'create-flashcard';

// Track ongoing requests to prevent duplicates
let isProcessing = false;
let lastRequestTime = 0;
const DEBOUNCE_DELAY = 2000; // 2 seconds

/**
 * Initialize extension on install
 */
chrome.runtime.onInstalled.addListener(() => {
  console.log('Highlight Flashcard Extension installed');
  createContextMenu();
});

/**
 * Create context menu item
 */
function createContextMenu() {
  chrome.contextMenus.create({
    id: CONTEXT_MENU_ID,
    title: 'Create Flashcard',
    contexts: ['selection']
  });
}

/**
 * Handle context menu clicks
 */
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== CONTEXT_MENU_ID) return;

  // Debounce rapid clicks
  const now = Date.now();
  if (isProcessing || (now - lastRequestTime) < DEBOUNCE_DELAY) {
    showNotification('Please wait', 'Already creating a flashcard...', 'info');
    return;
  }

  isProcessing = true;
  lastRequestTime = now;

  try {
    await createFlashcard(info.selectionText, tab.url);
  } finally {
    isProcessing = false;
  }
});

/**
 * Create a flashcard from selected text
 * @param {string} selectedText - The text selected by user
 * @param {string} sourceUrl - The URL where text was selected
 */
async function createFlashcard(selectedText, sourceUrl) {
  if (!selectedText || selectedText.trim() === '') {
    showNotification('Error', 'No text selected', 'error');
    return;
  }

  // Truncate if too long
  const word = selectedText.length > 500
    ? selectedText.substring(0, 500)
    : selectedText;

  if (selectedText.length > 500) {
    console.warn('Selection truncated to 500 characters');
  }

  // Load settings
  const settings = await Storage.getSettings();

  // Check if API key is configured
  if (!settings.apiKey) {
    showNotification(
      'API Key Required',
      'Please configure your OpenRouter API key in settings',
      'error'
    );
    // Open settings page
    chrome.runtime.openOptionsPage();
    return;
  }

  // Determine prompt to use
  const prompt = settings.useDefaultPrompt
    ? Storage.getDefaultPrompt()
    : settings.customPrompt || Storage.getDefaultPrompt();

  // Show processing notification and badge
  showNotification(
    'Creating Flashcard',
    `Creating flashcard for "${truncateText(word, 30)}"...`,
    'info'
  );

  // Show loading badge
  chrome.action.setBadgeText({ text: '...' });
  chrome.action.setBadgeBackgroundColor({ color: '#4f46e5' });

  try {
    // Create API client and generate definition
    const client = new OpenRouterClient(settings.apiKey, settings.selectedModel);
    const result = await client.createDefinition(word, prompt);

    if (!result.success) {
      throw new Error(result.error);
    }

    // Save flashcard
    const flashcard = {
      word: word.trim(),
      definition: result.definition,
      sourceUrl: sourceUrl,
      model: settings.selectedModel,
      prompt: prompt,
      createdAt: Date.now()
    };

    const saved = await Storage.addFlashcard(flashcard);

    if (!saved) {
      throw new Error('Failed to save flashcard');
    }

    // Show success notification
    showNotification(
      'Flashcard Created',
      `Successfully created flashcard for "${truncateText(word, 30)}"`,
      'success'
    );

    // Clear badge
    chrome.action.setBadgeText({ text: '' });

    console.log('Flashcard created:', flashcard);
  } catch (error) {
    console.error('Error creating flashcard:', error);

    // Show error notification
    showNotification(
      'Error',
      `Failed to create flashcard: ${error.message}`,
      'error'
    );

    // Clear badge
    chrome.action.setBadgeText({ text: '' });
  }
}

/**
 * Show browser notification
 * @param {string} title - Notification title
 * @param {string} message - Notification message
 * @param {string} type - Notification type (success, error, info)
 */
function showNotification(title, message, type = 'info') {
  // Map type to icon
  const iconMap = {
    success: 'icons/icon48.png',
    error: 'icons/icon48.png',
    info: 'icons/icon48.png'
  };

  chrome.notifications.create({
    type: 'basic',
    iconUrl: iconMap[type],
    title: title,
    message: message,
    priority: 1
  });
}

/**
 * Truncate text with ellipsis
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated text
 */
function truncateText(text, maxLength) {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

/**
 * Handle messages from other parts of the extension
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'testApiConnection') {
    testApiConnection(request.apiKey, request.model)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep channel open for async response
  }

  if (request.action === 'getStorageStats') {
    Storage.getStorageStats()
      .then(stats => sendResponse(stats))
      .catch(error => sendResponse({ error: error.message }));
    return true;
  }
});

/**
 * Test API connection
 * @param {string} apiKey - API key to test
 * @param {string} model - Model to test with
 * @returns {Promise<Object>} Test result
 */
async function testApiConnection(apiKey, model) {
  if (!apiKey) {
    return {
      success: false,
      error: 'API key is required'
    };
  }

  try {
    const client = new OpenRouterClient(apiKey, model);
    return await client.testConnection();
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

console.log('Background service worker loaded');
