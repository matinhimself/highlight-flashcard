/**
 * Settings page logic for Highlight Flashcard Extension
 */

import Storage from '../lib/storage.js';

// DOM elements
let apiKeyInput;
let toggleApiKeyBtn;
let modelSelect;
let usePresetModelRadio;
let useCustomModelRadio;
let presetModelSection;
let customModelSection;
let customModelIdInput;
let useDefaultPromptRadio;
let useCustomPromptRadio;
let customPromptTextarea;
let defaultPromptSection;
let customPromptSection;
let defaultPromptPreview;
let charCount;
let saveButton;
let resetButton;
let testConnectionBtn;
let connectionStatus;
let notification;
let flashcardCount;
let storageUsed;

// State
let isDirty = false;
let originalSettings = null;

/**
 * Initialize the settings page
 */
async function init() {
  // Get DOM elements
  apiKeyInput = document.getElementById('apiKey');
  toggleApiKeyBtn = document.getElementById('toggleApiKey');
  modelSelect = document.getElementById('model');
  usePresetModelRadio = document.getElementById('usePresetModel');
  useCustomModelRadio = document.getElementById('useCustomModel');
  presetModelSection = document.getElementById('presetModelSection');
  customModelSection = document.getElementById('customModelSection');
  customModelIdInput = document.getElementById('customModelId');
  useDefaultPromptRadio = document.getElementById('useDefaultPrompt');
  useCustomPromptRadio = document.getElementById('useCustomPrompt');
  customPromptTextarea = document.getElementById('customPrompt');
  defaultPromptSection = document.getElementById('defaultPromptSection');
  customPromptSection = document.getElementById('customPromptSection');
  defaultPromptPreview = document.getElementById('defaultPromptPreview');
  charCount = document.getElementById('charCount');
  saveButton = document.getElementById('saveSettings');
  resetButton = document.getElementById('resetSettings');
  testConnectionBtn = document.getElementById('testConnection');
  connectionStatus = document.getElementById('connectionStatus');
  notification = document.getElementById('notification');
  flashcardCount = document.getElementById('flashcardCount');
  storageUsed = document.getElementById('storageUsed');

  // Set up event listeners
  setupEventListeners();

  // Load settings
  await loadSettings();

  // Load storage stats
  await loadStorageStats();

  // Show default prompt
  defaultPromptPreview.textContent = Storage.getDefaultPrompt();
}

/**
 * Set up event listeners
 */
function setupEventListeners() {
  // Toggle API key visibility
  toggleApiKeyBtn.addEventListener('click', () => {
    const type = apiKeyInput.type === 'password' ? 'text' : 'password';
    apiKeyInput.type = type;
    toggleApiKeyBtn.textContent = type === 'password' ? '👁️' : '🙈';
  });

  // Mark form as dirty on changes
  apiKeyInput.addEventListener('input', () => {
    markDirty();
    updateConnectionStatus('hidden');
  });

  modelSelect.addEventListener('change', markDirty);
  customModelIdInput.addEventListener('input', markDirty);

  usePresetModelRadio.addEventListener('change', () => {
    toggleModelSections();
    markDirty();
  });

  useCustomModelRadio.addEventListener('change', () => {
    toggleModelSections();
    markDirty();
  });

  useDefaultPromptRadio.addEventListener('change', () => {
    togglePromptSections();
    markDirty();
  });

  useCustomPromptRadio.addEventListener('change', () => {
    togglePromptSections();
    markDirty();
  });

  customPromptTextarea.addEventListener('input', () => {
    updateCharCount();
    markDirty();
  });

  // Test connection
  testConnectionBtn.addEventListener('click', testConnection);

  // Save settings
  saveButton.addEventListener('click', saveSettings);

  // Reset settings
  resetButton.addEventListener('click', resetSettings);

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + S to save
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      if (!saveButton.disabled) {
        saveSettings();
      }
    }
  });
}

/**
 * Load settings from storage
 */
async function loadSettings() {
  const settings = await Storage.getSettings();
  originalSettings = { ...settings };

  // Populate form
  apiKeyInput.value = settings.apiKey || '';

  // Handle model selection
  if (settings.useCustomModel) {
    useCustomModelRadio.checked = true;
    customModelIdInput.value = settings.customModelId || '';
  } else {
    usePresetModelRadio.checked = true;
    modelSelect.value = settings.selectedModel || 'anthropic/claude-3.5-sonnet';
  }

  customPromptTextarea.value = settings.customPrompt || '';

  if (settings.useDefaultPrompt) {
    useDefaultPromptRadio.checked = true;
  } else {
    useCustomPromptRadio.checked = true;
  }

  toggleModelSections();
  togglePromptSections();
  updateCharCount();

  // Reset dirty flag
  isDirty = false;
  saveButton.disabled = true;
}

/**
 * Load storage statistics
 */
async function loadStorageStats() {
  try {
    const stats = await chrome.runtime.sendMessage({ action: 'getStorageStats' });

    if (stats) {
      flashcardCount.textContent = stats.flashcardCount || 0;
      const usedMB = (stats.bytesUsed / 1024 / 1024).toFixed(2);
      storageUsed.textContent = usedMB;

      if (stats.percentUsed > 80) {
        storageUsed.style.color = 'var(--error-color)';
      }
    }
  } catch (error) {
    console.error('Error loading storage stats:', error);
  }
}

/**
 * Toggle between preset and custom model sections
 */
function toggleModelSections() {
  if (usePresetModelRadio.checked) {
    presetModelSection.classList.remove('hidden');
    customModelSection.classList.add('hidden');
  } else {
    presetModelSection.classList.add('hidden');
    customModelSection.classList.remove('hidden');
  }
}

/**
 * Toggle between default and custom prompt sections
 */
function togglePromptSections() {
  if (useDefaultPromptRadio.checked) {
    defaultPromptSection.classList.remove('hidden');
    customPromptSection.classList.add('hidden');
  } else {
    defaultPromptSection.classList.add('hidden');
    customPromptSection.classList.remove('hidden');
  }
}

/**
 * Update character count for custom prompt
 */
function updateCharCount() {
  const count = customPromptTextarea.value.length;
  charCount.textContent = count;

  if (count > 2000) {
    charCount.style.color = 'var(--error-color)';
  } else {
    charCount.style.color = 'var(--text-secondary)';
  }
}

/**
 * Mark form as dirty (has unsaved changes)
 */
function markDirty() {
  isDirty = true;
  saveButton.disabled = false;
}

/**
 * Test API connection
 */
async function testConnection() {
  const apiKey = apiKeyInput.value.trim();
  const useCustomModel = useCustomModelRadio.checked;
  const customModelId = customModelIdInput.value.trim();
  const selectedModel = modelSelect.value;
  const model = useCustomModel ? customModelId : selectedModel;

  if (!apiKey) {
    showNotification('Please enter an API key', 'error');
    return;
  }

  // Validate API key format
  if (!apiKey.startsWith('sk-or-') || apiKey.length < 20) {
    showNotification('Invalid API key format. Should start with "sk-or-" and be at least 20 characters.', 'error');
    return;
  }

  // Validate model
  if (useCustomModel && customModelId === '') {
    showNotification('Please enter a custom model ID', 'error');
    return;
  }

  updateConnectionStatus('loading');
  testConnectionBtn.disabled = true;

  try {
    const result = await chrome.runtime.sendMessage({
      action: 'testApiConnection',
      apiKey,
      model
    });

    if (result.success) {
      updateConnectionStatus('success');
      showNotification('Connection successful!', 'success');
    } else {
      updateConnectionStatus('error');
      showNotification(`Connection failed: ${result.error}`, 'error');
    }
  } catch (error) {
    updateConnectionStatus('error');
    showNotification(`Error: ${error.message}`, 'error');
  } finally {
    testConnectionBtn.disabled = false;
  }
}

/**
 * Update connection status badge
 * @param {string} status - Status: success, error, loading, hidden
 */
function updateConnectionStatus(status) {
  connectionStatus.className = 'status-badge';

  if (status === 'hidden') {
    connectionStatus.classList.add('hidden');
    return;
  }

  connectionStatus.classList.remove('hidden');

  switch (status) {
    case 'success':
      connectionStatus.classList.add('success');
      connectionStatus.textContent = '✓ Connected';
      break;
    case 'error':
      connectionStatus.classList.add('error');
      connectionStatus.textContent = '✗ Connection Failed';
      break;
    case 'loading':
      connectionStatus.classList.add('loading');
      connectionStatus.textContent = '⏳ Testing...';
      break;
  }
}

/**
 * Save settings
 */
async function saveSettings() {
  const apiKey = apiKeyInput.value.trim();
  const useCustomModel = useCustomModelRadio.checked;
  const customModelId = customModelIdInput.value.trim();
  const selectedModel = modelSelect.value;
  const useDefaultPrompt = useDefaultPromptRadio.checked;
  const customPrompt = customPromptTextarea.value.trim();

  // Validate
  if (!apiKey) {
    showNotification('API key is required', 'error');
    return;
  }

  if (!apiKey.startsWith('sk-or-') || apiKey.length < 20) {
    showNotification('Invalid API key format', 'error');
    return;
  }

  // Validate model selection
  if (useCustomModel && customModelId === '') {
    showNotification('Custom model ID cannot be empty when selected', 'error');
    return;
  }

  if (useCustomModel && !customModelId.includes('/')) {
    showNotification('Custom model ID should be in format: provider/model-name', 'warning');
    // Don't return, just warn
  }

  if (!useDefaultPrompt && customPrompt.length > 2000) {
    showNotification('Custom prompt must be 2000 characters or less', 'error');
    return;
  }

  if (!useDefaultPrompt && customPrompt === '') {
    showNotification('Custom prompt cannot be empty when selected', 'warning');
    return;
  }

  // Determine which model to save
  const finalModel = useCustomModel ? customModelId : selectedModel;

  // Save
  const settings = {
    apiKey,
    selectedModel: finalModel,
    useCustomModel,
    customModelId: useCustomModel ? customModelId : '',
    customPrompt,
    useDefaultPrompt
  };

  saveButton.disabled = true;
  const success = await Storage.saveSettings(settings);

  if (success) {
    originalSettings = { ...settings };
    isDirty = false;
    showNotification('Settings saved successfully!', 'success');
  } else {
    saveButton.disabled = false;
    showNotification('Failed to save settings', 'error');
  }
}

/**
 * Reset settings to defaults
 */
async function resetSettings() {
  if (!confirm('Reset all settings to defaults? This cannot be undone.')) {
    return;
  }

  const defaultSettings = {
    apiKey: '',
    selectedModel: 'anthropic/claude-3.5-sonnet',
    useCustomModel: false,
    customModelId: '',
    customPrompt: '',
    useDefaultPrompt: true
  };

  const success = await Storage.saveSettings(defaultSettings);

  if (success) {
    await loadSettings();
    updateConnectionStatus('hidden');
    showNotification('Settings reset to defaults', 'success');
  } else {
    showNotification('Failed to reset settings', 'error');
  }
}

/**
 * Show notification
 * @param {string} message - Notification message
 * @param {string} type - Notification type: success, error, warning, info
 */
function showNotification(message, type = 'info') {
  notification.textContent = message;
  notification.className = `notification ${type}`;
  notification.classList.remove('hidden');

  // Auto-hide after 5 seconds
  setTimeout(() => {
    notification.classList.add('hidden');
  }, 5000);
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
