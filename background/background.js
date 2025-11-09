/**
 * Background service worker for Highlight Flashcard Extension
 * Handles context menu creation and flashcard generation
 */

import Storage from '../lib/storage.js';
import OpenRouterClient from './api.js';

// Context menu IDs
const CONTEXT_MENU_ID = 'create-flashcard';
const DESCRIBE_PARENT_ID = 'describe-parent';
const SAVE_TO_NOTEBOOK_ID = 'save-to-notebook';

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
 * Create context menu items
 */
async function createContextMenu() {
  // Remove all existing menu items
  await chrome.contextMenus.removeAll();

  // Create Flashcard menu item
  chrome.contextMenus.create({
    id: CONTEXT_MENU_ID,
    title: 'Create Flashcard',
    contexts: ['selection']
  });

  // Create Save to Notebook menu item
  chrome.contextMenus.create({
    id: SAVE_TO_NOTEBOOK_ID,
    title: 'Save to Notebook',
    contexts: ['selection']
  });

  // Create Describe parent menu item
  chrome.contextMenus.create({
    id: DESCRIBE_PARENT_ID,
    title: 'Describe',
    contexts: ['selection']
  });

  // Get enabled describe prompts and create submenu items
  const prompts = await Storage.getEnabledDescribePrompts();

  if (prompts.length === 0) {
    // If no prompts, show a disabled placeholder
    chrome.contextMenus.create({
      id: 'describe-no-prompts',
      parentId: DESCRIBE_PARENT_ID,
      title: 'No prompts available',
      contexts: ['selection'],
      enabled: false
    });
  } else {
    // Create submenu item for each enabled prompt
    prompts.forEach(prompt => {
      chrome.contextMenus.create({
        id: `describe-${prompt.id}`,
        parentId: DESCRIBE_PARENT_ID,
        title: prompt.name,
        contexts: ['selection']
      });
    });
  }
}

/**
 * Handle context menu clicks
 */
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const menuItemId = info.menuItemId;

  // Handle Create Flashcard
  if (menuItemId === CONTEXT_MENU_ID) {
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
    return;
  }

  // Handle Save to Notebook
  if (menuItemId === SAVE_TO_NOTEBOOK_ID) {
    await saveToNotebook(info.selectionText, tab.url, tab.title);
    return;
  }

  // Handle Describe submenu items
  if (typeof menuItemId === 'string' && menuItemId.startsWith('describe-')) {
    const promptId = menuItemId.replace('describe-', '');

    // Debounce rapid clicks
    const now = Date.now();
    if (isProcessing || (now - lastRequestTime) < DEBOUNCE_DELAY) {
      showNotification('Please wait', 'Already processing...', 'info');
      return;
    }

    isProcessing = true;
    lastRequestTime = now;

    try {
      await createDescription(info.selectionText, tab.url, tab.title, promptId);
    } finally {
      isProcessing = false;
    }
    return;
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

  // Determine prompt and schema to use
  let basePrompt = settings.useDefaultPrompt
    ? Storage.getDefaultPrompt()
    : settings.customPrompt || Storage.getDefaultPrompt();

  const schema = settings.useDefaultSchema
    ? Storage.getDefaultSchema()
    : settings.customSchema || Storage.getDefaultSchema();

  // Build final prompt with schema instructions
  const prompt = Storage.buildPromptWithSchema(basePrompt, schema);

  // Show processing notification and badge
  showNotification(
    'Creating Flashcard',
    `Creating flashcard for "${truncateText(word, 30)}"...`,
    'info'
  );

  // Show loading badge
  chrome.action.setBadgeText({ text: '...' });
  chrome.action.setBadgeBackgroundColor({ color: '#4f46e5' });

  // Auto-open popup to show progress
  try {
    await chrome.action.openPopup();
  } catch (e) {
    console.log('Could not open popup automatically:', e);
  }

  // Send progress: Step 1 - Preparing
  sendMessageToPopup({
    type: 'FLASHCARD_PROGRESS',
    step: 1,
    status: 'active',
    text: `Preparing flashcard for "${truncateText(word, 30)}"`
  });

  // Small delay to show step 1
  await new Promise(resolve => setTimeout(resolve, 300));

  // Mark step 1 as completed
  sendMessageToPopup({
    type: 'FLASHCARD_PROGRESS',
    step: 1,
    status: 'completed'
  });

  try {
    // Send progress: Step 2 - AI Processing
    sendMessageToPopup({
      type: 'FLASHCARD_PROGRESS',
      step: 2,
      status: 'active',
      text: 'Generating definition with AI...'
    });

    // Create API client and generate definition
    const client = new OpenRouterClient(settings.apiKey, settings.selectedModel);
    const result = await client.createDefinition(word, prompt);

    if (!result.success) {
      throw new Error(result.error);
    }

    // Mark step 2 as completed
    sendMessageToPopup({
      type: 'FLASHCARD_PROGRESS',
      step: 2,
      status: 'completed',
      text: 'AI processing complete!'
    });

    // Parse JSON response if using schema
    let flashcardData = {};
    try {
      // Clean the response - remove markdown code blocks if present
      let cleanedResponse = result.definition.trim();

      // Remove markdown code block wrappers (```json ... ``` or ``` ... ```)
      cleanedResponse = cleanedResponse.replace(/^```(?:json)?\s*\n?/i, '');
      cleanedResponse = cleanedResponse.replace(/\n?```\s*$/i, '');
      cleanedResponse = cleanedResponse.trim();

      // Try to parse as JSON
      const parsedData = JSON.parse(cleanedResponse);

      // Validate it's a proper object with expected fields
      if (typeof parsedData === 'object' && !Array.isArray(parsedData) && parsedData !== null) {
        // Check if it has at least one field from the schema
        const hasValidFields = Object.keys(parsedData).length > 0;
        if (hasValidFields) {
          flashcardData = parsedData;
          console.log('Successfully parsed flashcard data:', flashcardData);
        } else {
          console.warn('Parsed JSON is empty, treating as plain text');
          flashcardData = null; // Will use plain definition fallback
        }
      } else {
        console.warn('Parsed result is not a valid object, treating as plain text');
        flashcardData = null; // Will use plain definition fallback
      }
    } catch (e) {
      // If JSON parsing fails, treat as plain text (legacy format)
      console.warn('Failed to parse JSON response:', e.message);
      console.log('Raw response:', result.definition);
      flashcardData = null; // Will use plain definition fallback
    }

    // Send progress: Step 3 - Saving
    sendMessageToPopup({
      type: 'FLASHCARD_PROGRESS',
      step: 3,
      status: 'active',
      text: 'Saving flashcard...'
    });

    // Save flashcard with structured data
    const flashcard = {
      word: word.trim(),
      definition: result.definition, // Always store raw response as fallback
      sourceUrl: sourceUrl,
      model: settings.selectedModel,
      prompt: prompt,
      schema: schema,
      createdAt: Date.now()
    };

    // Only add structured data if parsing succeeded
    if (flashcardData && Object.keys(flashcardData).length > 0) {
      flashcard.data = flashcardData;
    }

    const saved = await Storage.addFlashcard(flashcard);

    if (!saved) {
      throw new Error('Failed to save flashcard');
    }

    // Mark step 3 as completed
    sendMessageToPopup({
      type: 'FLASHCARD_PROGRESS',
      step: 3,
      status: 'completed',
      text: 'Flashcard saved successfully!'
    });

    // Show success notification
    showNotification(
      'Flashcard Created',
      `Successfully created flashcard for "${truncateText(word, 30)}"`,
      'success'
    );

    // Clear badge
    chrome.action.setBadgeText({ text: '' });

    console.log('Flashcard created:', flashcard);

    // Send flashcard to popup for preview
    sendMessageToPopup({
      type: 'FLASHCARD_CREATED',
      flashcard: flashcard
    });
  } catch (error) {
    console.error('Error creating flashcard:', error);

    // Send error to popup
    sendMessageToPopup({
      type: 'FLASHCARD_ERROR',
      error: error.message
    });

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
 * Create a description from selected text using AI
 * @param {string} selectedText - The text selected by user
 * @param {string} sourceUrl - The URL where text was selected
 * @param {string} sourceTitle - The page title where text was selected
 * @param {string} promptId - The ID of the describe prompt to use
 */
async function createDescription(selectedText, sourceUrl, sourceTitle, promptId) {
  if (!selectedText || selectedText.trim() === '') {
    showNotification('Error', 'No text selected', 'error');
    return;
  }

  // Truncate if too long
  const text = selectedText.length > 2000
    ? selectedText.substring(0, 2000)
    : selectedText;

  if (selectedText.length > 2000) {
    console.warn('Selection truncated to 2000 characters');
  }

  // Load settings and prompts
  const settings = await Storage.getSettings();
  const prompts = await Storage.getDescribePrompts();
  const describePrompt = prompts.find(p => p.id === promptId);

  if (!describePrompt) {
    showNotification('Error', 'Describe prompt not found', 'error');
    return;
  }

  // Check if API key is configured
  if (!settings.apiKey) {
    showNotification(
      'API Key Required',
      'Please configure your OpenRouter API key in settings',
      'error'
    );
    chrome.runtime.openOptionsPage();
    return;
  }

  // Show processing notification and badge
  showNotification(
    'Creating Description',
    `Describing "${truncateText(text, 30)}" with ${describePrompt.name}...`,
    'info'
  );

  chrome.action.setBadgeText({ text: '...' });
  chrome.action.setBadgeBackgroundColor({ color: '#4f46e5' });

  try {
    // Create API client and generate description
    const client = new OpenRouterClient(settings.apiKey, settings.selectedModel);
    const result = await client.createDefinition(text, describePrompt.prompt);

    if (!result.success) {
      throw new Error(result.error);
    }

    // Save to highlights with description
    const highlight = {
      text: text.trim(),
      description: result.definition,
      sourceUrl: sourceUrl,
      sourceTitle: sourceTitle || extractDomain(sourceUrl),
      promptName: describePrompt.name,
      promptId: describePrompt.id,
      model: settings.selectedModel,
      type: 'described',
      createdAt: Date.now()
    };

    const saved = await Storage.addHighlight(highlight);

    if (!saved) {
      throw new Error('Failed to save highlight');
    }

    // Show success notification
    showNotification(
      'Description Created',
      `Successfully described "${truncateText(text, 30)}"`,
      'success'
    );

    chrome.action.setBadgeText({ text: '' });

    console.log('Description created:', highlight);
  } catch (error) {
    console.error('Error creating description:', error);

    showNotification(
      'Error',
      `Failed to create description: ${error.message}`,
      'error'
    );

    chrome.action.setBadgeText({ text: '' });
  }
}

/**
 * Save selected text to notebook without AI processing
 * @param {string} selectedText - The text selected by user
 * @param {string} sourceUrl - The URL where text was selected
 * @param {string} sourceTitle - The page title where text was selected
 */
async function saveToNotebook(selectedText, sourceUrl, sourceTitle) {
  if (!selectedText || selectedText.trim() === '') {
    showNotification('Error', 'No text selected', 'error');
    return;
  }

  // Truncate if too long (allow longer text for simple saves)
  const text = selectedText.length > 5000
    ? selectedText.substring(0, 5000)
    : selectedText;

  if (selectedText.length > 5000) {
    console.warn('Selection truncated to 5000 characters');
  }

  try {
    // Save to highlights without description
    const highlight = {
      text: text.trim(),
      sourceUrl: sourceUrl,
      sourceTitle: sourceTitle || extractDomain(sourceUrl),
      type: 'simple',
      createdAt: Date.now()
    };

    const saved = await Storage.addHighlight(highlight);

    if (!saved) {
      throw new Error('Failed to save highlight');
    }

    // Show success notification
    showNotification(
      'Saved to Notebook',
      `Successfully saved "${truncateText(text, 30)}"`,
      'success'
    );

    console.log('Highlight saved:', highlight);
  } catch (error) {
    console.error('Error saving to notebook:', error);

    showNotification(
      'Error',
      `Failed to save to notebook: ${error.message}`,
      'error'
    );
  }
}

/**
 * Extract domain from URL
 * @param {string} url - URL to extract domain from
 * @returns {string} Domain name
 */
function extractDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch (e) {
    return url;
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

  if (request.action === 'refreshContextMenu') {
    createContextMenu()
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
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

/**
 * Send message to popup (if it's open)
 * @param {Object} message - Message to send
 */
function sendMessageToPopup(message) {
  // Send message to all extension contexts (including popup if open)
  chrome.runtime.sendMessage(message).catch(error => {
    // Ignore errors if popup is not open
    console.log('Could not send message to popup:', error.message);
  });
}

console.log('Background service worker loaded');
