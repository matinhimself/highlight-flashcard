/**
 * Background service worker for Highlight Flashcard Extension
 * Handles context menu creation and flashcard generation
 */

import Storage from '../lib/storage.js';
import OpenRouterClient from './api.js';
import { driveClient } from './drive-api.js';

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
chrome.runtime.onInstalled.addListener(async () => {
  console.log('Highlight Flashcard Extension installed');

  // Initialize default describe prompts if not already set
  await initializeDefaults();

  createContextMenu();
});

/**
 * Initialize default settings and prompts on first install
 */
async function initializeDefaults() {
  try {
    const result = await chrome.storage.local.get('describePrompts');

    // If no describe prompts exist, initialize with defaults
    if (!result.describePrompts || result.describePrompts.length === 0) {
      const defaultPrompts = await Storage.getDescribePrompts();
      await chrome.storage.local.set({ describePrompts: defaultPrompts });
      console.log('Initialized default describe prompts');
    }
  } catch (error) {
    console.error('Error initializing defaults:', error);
  }
}

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
 * @param {string} xpath - XPath to the highlight location
 * @param {Object} position - Position coordinates {x, y}
 * @returns {Promise<string>} The ID of the saved highlight
 */
async function createDescription(selectedText, sourceUrl, sourceTitle, promptId, xpath = '', position = null) {
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
    type: 'DESCRIBE_PROGRESS',
    step: 1,
    status: 'active',
    text: `Preparing description for "${truncateText(text, 30)}"`
  });

  // Small delay to show step 1
  await new Promise(resolve => setTimeout(resolve, 300));

  // Mark step 1 as completed
  sendMessageToPopup({
    type: 'DESCRIBE_PROGRESS',
    step: 1,
    status: 'completed'
  });

  try {
    // Send progress: Step 2 - AI Processing
    sendMessageToPopup({
      type: 'DESCRIBE_PROGRESS',
      step: 2,
      status: 'active',
      text: 'Generating description with AI...'
    });

    // Build the prompt (with schema if enabled)
    let finalPrompt = describePrompt.prompt;

    if (describePrompt.useSchema) {
      // Get existing tags for this prompt to suggest
      const existingTags = await Storage.getAllTags(promptId);

      // Get schema
      const schema = describePrompt.schema || Storage.getDefaultDescribeSchema();

      // Build prompt with schema and existing tags
      finalPrompt = Storage.buildDescribePromptWithSchema(
        describePrompt.prompt,
        schema,
        existingTags
      );
    }

    // Create API client and generate description
    const client = new OpenRouterClient(settings.apiKey, settings.selectedModel);
    const result = await client.createDefinition(text, finalPrompt);

    if (!result.success) {
      throw new Error(result.error);
    }

    // Mark step 2 as completed
    sendMessageToPopup({
      type: 'DESCRIBE_PROGRESS',
      step: 2,
      status: 'completed',
      text: 'AI processing complete!'
    });

    // Parse response if using schema
    let descriptionData = {};
    let tags = [];
    let description = result.definition;

    if (describePrompt.useSchema) {
      try {
        // Clean the response - remove markdown code blocks if present
        let cleanedResponse = result.definition.trim();
        cleanedResponse = cleanedResponse.replace(/^```(?:json)?\s*\n?/i, '');
        cleanedResponse = cleanedResponse.replace(/\n?```\s*$/i, '');
        cleanedResponse = cleanedResponse.trim();

        // Parse JSON
        const parsedData = JSON.parse(cleanedResponse);

        if (typeof parsedData === 'object' && !Array.isArray(parsedData) && parsedData !== null) {
          descriptionData = parsedData;

          // Extract tags
          if (parsedData.tags) {
            if (Array.isArray(parsedData.tags)) {
              tags = parsedData.tags;
            } else if (typeof parsedData.tags === 'string') {
              // Handle comma-separated string
              tags = parsedData.tags.split(',').map(t => t.trim()).filter(t => t);
            }
          }

          // Use summary as description if available
          if (parsedData.summary) {
            description = parsedData.summary;
          }

          console.log('Successfully parsed describe data:', descriptionData);
        }
      } catch (e) {
        // If JSON parsing fails, treat as plain text
        console.warn('Failed to parse JSON response:', e.message);
        console.log('Raw response:', result.definition);
      }
    }

    // Send progress: Step 3 - Saving
    sendMessageToPopup({
      type: 'DESCRIBE_PROGRESS',
      step: 3,
      status: 'active',
      text: 'Saving description...'
    });

    // Save to highlights with description and tags
    const highlight = {
      text: text.trim(),
      description: description,
      sourceUrl: sourceUrl,
      sourceTitle: sourceTitle || extractDomain(sourceUrl),
      promptName: describePrompt.name,
      promptId: describePrompt.id,
      model: settings.selectedModel,
      type: 'described',
      createdAt: Date.now()
    };

    // Add xpath and position if provided
    if (xpath) {
      highlight.xpath = xpath;
    }
    if (position) {
      highlight.position = position;
    }

    // Add structured data if available
    if (Object.keys(descriptionData).length > 0) {
      highlight.data = descriptionData;
    }

    // Add tags if available
    if (tags.length > 0) {
      highlight.tags = tags;
    }

    const saved = await Storage.addHighlight(highlight);

    if (!saved) {
      throw new Error('Failed to save highlight');
    }

    // Get the highlight ID (it's generated in addHighlight)
    const highlights = await Storage.getHighlights();
    const savedHighlight = highlights[0]; // Most recent (added to beginning)
    const highlightId = savedHighlight.id;

    // Mark step 3 as completed
    sendMessageToPopup({
      type: 'DESCRIBE_PROGRESS',
      step: 3,
      status: 'completed',
      text: 'Description saved successfully!'
    });

    // Show success notification
    showNotification(
      'Description Created',
      `Successfully described "${truncateText(text, 30)}"`,
      'success'
    );

    // Clear badge
    chrome.action.setBadgeText({ text: '' });

    console.log('Description created:', highlight);

    // Send description to popup for preview
    sendMessageToPopup({
      type: 'DESCRIBE_CREATED',
      description: highlight
    });

    // Return the highlight ID
    return highlightId;
  } catch (error) {
    console.error('Error creating description:', error);

    // Send error to popup
    sendMessageToPopup({
      type: 'DESCRIBE_ERROR',
      error: error.message
    });

    // Show error notification
    showNotification(
      'Error',
      `Failed to create description: ${error.message}`,
      'error'
    );

    // Clear badge
    chrome.action.setBadgeText({ text: '' });

    throw error;
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
 * Handle describe action from toolbar (uses first enabled prompt)
 * @param {string} selectedText - The text to describe
 * @param {string} sourceUrl - The URL where text was selected
 * @param {string} sourceTitle - The title of the page
 */
async function handleToolbarDescribe(selectedText, sourceUrl, sourceTitle) {
  // Get the first enabled describe prompt
  const prompts = await Storage.getEnabledDescribePrompts();

  if (prompts.length === 0) {
    showNotification('No Prompts', 'Please configure describe prompts in settings', 'error');
    return;
  }

  // Use the first enabled prompt
  const firstPrompt = prompts[0];
  await createDescription(selectedText, sourceUrl, sourceTitle, firstPrompt.id);
}

/**
 * Generate preview for selected text using AI
 * @param {string} selectedText - The text to preview
 * @returns {Promise<Object>} Preview result with data and rendered HTML
 */
async function generatePreview(selectedText) {
  if (!selectedText || selectedText.trim() === '') {
    return {
      success: false,
      error: 'No text selected'
    };
  }

  // Load settings
  const settings = await Storage.getSettings();

  // Check if API key is configured
  if (!settings.apiKey) {
    return {
      success: false,
      error: 'Please configure your OpenRouter API key in settings'
    };
  }

  // Truncate if too long
  const text = selectedText.length > 500
    ? selectedText.substring(0, 500)
    : selectedText;

  // Get preview template from settings
  const previewTemplate = settings.useDefaultPreviewTemplate
    ? Storage.getDefaultPreviewTemplate()
    : settings.previewTemplate || Storage.getDefaultPreviewTemplate();

  // Determine prompt and schema to use
  let basePrompt = settings.useDefaultPrompt
    ? Storage.getDefaultPrompt()
    : settings.customPrompt || Storage.getDefaultPrompt();

  const schema = settings.useDefaultSchema
    ? Storage.getDefaultSchema()
    : settings.customSchema || Storage.getDefaultSchema();

  // Build final prompt with schema instructions
  const prompt = Storage.buildPromptWithSchema(basePrompt, schema);

  try {
    // Create API client and generate definition
    const client = new OpenRouterClient(settings.apiKey, settings.selectedModel);
    const result = await client.createDefinition(text, prompt);

    if (!result.success) {
      throw new Error(result.error);
    }

    // Parse JSON response
    let flashcardData = {};
    try {
      let cleanedResponse = result.definition.trim();
      cleanedResponse = cleanedResponse.replace(/^```(?:json)?\s*\n?/i, '');
      cleanedResponse = cleanedResponse.replace(/\n?```\s*$/i, '');
      cleanedResponse = cleanedResponse.trim();

      const parsedData = JSON.parse(cleanedResponse);

      if (typeof parsedData === 'object' && !Array.isArray(parsedData) && parsedData !== null) {
        flashcardData = parsedData;
      }
    } catch (e) {
      console.warn('Failed to parse JSON response for preview:', e.message);
      // Use raw definition as fallback
      flashcardData = { definition: result.definition };
    }

    // Render preview using template
    const rendered = Storage.renderTemplate(previewTemplate, {
      word: text,
      ...flashcardData
    });

    // Apply markdown formatting to rendered template
    const previewHtml = applyMarkdownFormatting(rendered);

    return {
      success: true,
      data: flashcardData,
      preview: previewHtml
    };
  } catch (error) {
    console.error('Error generating preview:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Apply markdown formatting to text
 * @param {string} text - Text with markdown syntax
 * @returns {string} HTML formatted text
 */
function applyMarkdownFormatting(text) {
  if (!text) return '';

  // Escape HTML first
  let formatted = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  // Headings (must be on their own line)
  formatted = formatted.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  formatted = formatted.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  formatted = formatted.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // Horizontal rules
  formatted = formatted.replace(/^---$/gm, '<hr>');
  formatted = formatted.replace(/^\*\*\*$/gm, '<hr>');

  // Code blocks ```code```
  formatted = formatted.replace(/```([^`]+)```/g, '<pre><code>$1</code></pre>');

  // Inline code `code`
  formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Bold text **text** (use non-greedy match)
  formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // Italic text *text* (use non-greedy match, avoid matching within words)
  formatted = formatted.replace(/(?<!\w)\*(.+?)\*(?!\w)/g, '<em>$1</em>');

  // Unordered lists - items (lines starting with -)
  formatted = formatted.replace(/^- (.+)$/gm, '<li>$1</li>');
  // Wrap consecutive <li> items in <ul>
  formatted = formatted.replace(/(<li>.*?<\/li>(?:\n|$))+/g, function(match) {
    return '<ul>' + match + '</ul>';
  });

  // Ordered lists - items (lines starting with number.)
  formatted = formatted.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

  // Links [text](url)
  formatted = formatted.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');

  // Line breaks (convert double newlines to paragraphs, single to <br>)
  formatted = formatted.replace(/\n\n+/g, '</p><p>');
  formatted = formatted.replace(/\n/g, '<br>');

  // Wrap in paragraph if doesn't start with block element
  if (!formatted.match(/^<(?:h[1-6]|ul|ol|pre|hr|div|p)/)) {
    formatted = '<p>' + formatted + '</p>';
  }

  return formatted;
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

  // Toolbar action: Create flashcard
  if (request.action === 'createFlashcard') {
    createFlashcard(request.text, request.sourceUrl)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  // Toolbar action: Save highlight
  if (request.action === 'saveHighlight') {
    saveToNotebook(request.text, request.sourceUrl, request.sourceTitle)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  // Toolbar action: Describe text
  if (request.action === 'describeText') {
    handleToolbarDescribe(request.text, request.sourceUrl, request.sourceTitle)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  // Toolbar action: Describe with specific prompt
  if (request.action === 'describeWithPrompt') {
    createDescription(request.text, request.sourceUrl, request.sourceTitle, request.promptId, request.xpath, request.position)
      .then((highlightId) => sendResponse({ success: true, highlightId: highlightId }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  // Get a specific highlight by ID
  if (request.action === 'getHighlight') {
    Storage.getHighlights()
      .then(highlights => {
        const highlight = highlights.find(h => h.id === request.highlightId);
        if (highlight) {
          sendResponse({ success: true, highlight: highlight });
        } else {
          sendResponse({ success: false, error: 'Highlight not found' });
        }
      })
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  // Get highlights for a specific URL
  if (request.action === 'getHighlightsForUrl') {
    Storage.getHighlights()
      .then(highlights => {
        // Filter highlights for this URL that have xpath or position data
        const urlHighlights = highlights.filter(h =>
          h.sourceUrl === request.url &&
          h.type === 'described' &&
          (h.xpath || h.position)
        );
        sendResponse({ success: true, highlights: urlHighlights });
      })
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  // Toolbar action: Generate preview
  if (request.action === 'generatePreview') {
    generatePreview(request.text)
      .then(result => sendResponse(result))
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

// ===========================
// Google Drive Sync Handlers
// ===========================

let syncTimer = null;
const SYNC_DEBOUNCE_DELAY = 2000; // 2 seconds

/**
 * Queue a sync operation (debounced)
 */
function queueSync() {
  if (syncTimer) {
    clearTimeout(syncTimer);
  }

  syncTimer = setTimeout(async () => {
    await performSync();
  }, SYNC_DEBOUNCE_DELAY);
}

/**
 * Perform sync with Google Drive
 */
async function performSync() {
  try {
    const config = await chrome.storage.local.get(['googleDriveEnabled']);
    if (!config.googleDriveEnabled) {
      return; // Sync disabled
    }

    // Check if authenticated
    const isAuth = await driveClient.isAuthenticated();
    if (!isAuth) {
      console.log('Not authenticated, skipping sync');
      return;
    }

    // Perform full sync
    const result = await driveClient.performFullSync(Storage);

    console.log('Sync completed:', result);

    // Notify UI if needed
    if (result.flashcardsUpdated || result.highlightsUpdated) {
      sendMessageToPopup({
        type: 'SYNC_COMPLETED',
        result: result
      });
    }

    return result;
  } catch (error) {
    console.error('Sync failed:', error);

    // Notify UI of error
    sendMessageToPopup({
      type: 'SYNC_ERROR',
      error: error.message
    });

    throw error;
  }
}

/**
 * Perform initial sync on extension startup
 */
async function performInitialSync() {
  try {
    const config = await chrome.storage.local.get(['googleDriveEnabled', 'initialSyncDone']);

    if (!config.googleDriveEnabled) {
      return;
    }

    // Only do initial sync once per session
    if (config.initialSyncDone) {
      return;
    }

    const isAuth = await driveClient.isAuthenticated();
    if (!isAuth) {
      return;
    }

    console.log('Performing initial sync...');
    await performSync();

    await chrome.storage.local.set({ initialSyncDone: true });
  } catch (error) {
    console.error('Initial sync failed:', error);
  }
}

// Handle sync messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'QUEUE_SYNC') {
    queueSync();
    sendResponse({ success: true });
    return true;
  }

  if (request.type === 'SYNC_NOW') {
    performSync()
      .then(result => sendResponse({ success: true, result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.type === 'INITIAL_SYNC') {
    performSync()
      .then(result => sendResponse({ success: true, result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.type === 'SIGN_OUT_DRIVE') {
    driveClient.signOut()
      .then(() => {
        chrome.storage.local.set({
          googleDriveEnabled: false,
          googleDriveUser: null,
          lastSyncTimestamp: null
        });
        sendResponse({ success: true });
      })
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

// Perform initial sync on startup (if enabled)
performInitialSync();

// Periodic sync every 5 minutes (if enabled)
setInterval(async () => {
  const config = await chrome.storage.local.get(['googleDriveEnabled']);
  if (config.googleDriveEnabled) {
    await performSync().catch(err => console.error('Periodic sync failed:', err));
  }
}, 5 * 60 * 1000); // 5 minutes

console.log('Background service worker loaded');
