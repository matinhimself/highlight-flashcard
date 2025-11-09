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
let useDefaultSchemaRadio;
let useCustomSchemaRadio;
let customSchemaTextarea;
let defaultSchemaSection;
let customSchemaSection;
let defaultSchemaPreview;
let schemaCharCount;
let validateSchemaBtn;
let saveButton;
let resetButton;
let testConnectionBtn;
let connectionStatus;
let notification;
let flashcardCount;
let highlightsCount;
let storageUsed;
let describePromptsList;
let addDescribePromptBtn;
let describePromptModal;
let promptModalTitle;
let promptNameInput;
let promptTextInput;
let promptEnabledCheckbox;
let savePromptBtn;
let cancelPromptBtn;
let closePromptModalBtn;

// State
let isDirty = false;
let originalSettings = null;
let currentEditingPromptId = null;

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
  useDefaultSchemaRadio = document.getElementById('useDefaultSchema');
  useCustomSchemaRadio = document.getElementById('useCustomSchema');
  customSchemaTextarea = document.getElementById('customSchema');
  defaultSchemaSection = document.getElementById('defaultSchemaSection');
  customSchemaSection = document.getElementById('customSchemaSection');
  defaultSchemaPreview = document.getElementById('defaultSchemaPreview');
  schemaCharCount = document.getElementById('schemaCharCount');
  validateSchemaBtn = document.getElementById('validateSchema');
  saveButton = document.getElementById('saveSettings');
  resetButton = document.getElementById('resetSettings');
  testConnectionBtn = document.getElementById('testConnection');
  connectionStatus = document.getElementById('connectionStatus');
  notification = document.getElementById('notification');
  flashcardCount = document.getElementById('flashcardCount');
  highlightsCount = document.getElementById('highlightsCount');
  storageUsed = document.getElementById('storageUsed');
  describePromptsList = document.getElementById('describePromptsList');
  addDescribePromptBtn = document.getElementById('addDescribePrompt');
  describePromptModal = document.getElementById('describePromptModal');
  promptModalTitle = document.getElementById('promptModalTitle');
  promptNameInput = document.getElementById('promptName');
  promptTextInput = document.getElementById('promptText');
  promptEnabledCheckbox = document.getElementById('promptEnabled');
  savePromptBtn = document.getElementById('savePrompt');
  cancelPromptBtn = document.getElementById('cancelPrompt');
  closePromptModalBtn = document.getElementById('closePromptModal');

  // Set up event listeners
  setupEventListeners();

  // Load settings
  await loadSettings();

  // Load storage stats
  await loadStorageStats();

  // Load describe prompts
  await loadDescribePrompts();

  // Show default prompt and schema
  defaultPromptPreview.textContent = Storage.getDefaultPrompt();
  defaultSchemaPreview.textContent = JSON.stringify(Storage.getDefaultSchema(), null, 2);
}

/**
 * Set up event listeners
 */
function setupEventListeners() {
  // Toggle API key visibility
  toggleApiKeyBtn.addEventListener('click', () => {
    const type = apiKeyInput.type === 'password' ? 'text' : 'password';
    apiKeyInput.type = type;
    const icon = toggleApiKeyBtn.querySelector('i');
    if (icon) {
      icon.setAttribute('data-lucide', type === 'password' ? 'eye' : 'eye-off');
      if (window.lucide) {
        window.lucide.createIcons({ nameAttr: 'data-lucide' });
      }
    }
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

  useDefaultSchemaRadio.addEventListener('change', () => {
    toggleSchemaSections();
    markDirty();
  });

  useCustomSchemaRadio.addEventListener('change', () => {
    toggleSchemaSections();
    markDirty();
  });

  customSchemaTextarea.addEventListener('input', () => {
    updateSchemaCharCount();
    markDirty();
  });

  // Validate schema JSON
  validateSchemaBtn.addEventListener('click', validateSchema);

  // Test connection
  testConnectionBtn.addEventListener('click', testConnection);

  // Describe prompts
  addDescribePromptBtn.addEventListener('click', openAddPromptModal);
  savePromptBtn.addEventListener('click', saveDescribePrompt);
  cancelPromptBtn.addEventListener('click', closePromptModal);
  closePromptModalBtn.addEventListener('click', closePromptModal);

  // Close modal on background click
  describePromptModal.addEventListener('click', (e) => {
    if (e.target === describePromptModal) {
      closePromptModal();
    }
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closePromptModal();
    }
  });

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

  // Handle schema selection
  customSchemaTextarea.value = settings.customSchema || '';

  if (settings.useDefaultSchema !== false) {
    useDefaultSchemaRadio.checked = true;
  } else {
    useCustomSchemaRadio.checked = true;
  }

  toggleModelSections();
  togglePromptSections();
  toggleSchemaSections();
  updateCharCount();
  updateSchemaCharCount();

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
    const highlights = await Storage.getHighlights();

    if (stats) {
      flashcardCount.textContent = stats.flashcardCount || 0;
      highlightsCount.textContent = highlights.length || 0;
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
 * Toggle between default and custom schema sections
 */
function toggleSchemaSections() {
  if (useDefaultSchemaRadio.checked) {
    defaultSchemaSection.classList.remove('hidden');
    customSchemaSection.classList.add('hidden');
  } else {
    defaultSchemaSection.classList.add('hidden');
    customSchemaSection.classList.remove('hidden');
  }
}

/**
 * Update character count for custom schema
 */
function updateSchemaCharCount() {
  const count = customSchemaTextarea.value.length;
  schemaCharCount.textContent = count;

  if (count > 2000) {
    schemaCharCount.style.color = 'var(--error-color)';
  } else {
    schemaCharCount.style.color = 'var(--text-secondary)';
  }
}

/**
 * Validate schema JSON
 */
function validateSchema() {
  const schemaText = customSchemaTextarea.value.trim();

  if (!schemaText) {
    showNotification('Schema is empty', 'warning');
    return;
  }

  try {
    const parsed = JSON.parse(schemaText);
    if (typeof parsed !== 'object' || Array.isArray(parsed)) {
      showNotification('Schema must be a JSON object (not an array)', 'error');
      return;
    }
    showNotification('Valid JSON schema!', 'success');
  } catch (error) {
    showNotification(`Invalid JSON: ${error.message}`, 'error');
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
  const useDefaultSchema = useDefaultSchemaRadio.checked;
  const customSchema = customSchemaTextarea.value.trim();

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

  // Validate schema selection
  if (!useDefaultSchema && customSchema.length > 2000) {
    showNotification('Custom schema must be 2000 characters or less', 'error');
    return;
  }

  if (!useDefaultSchema && customSchema === '') {
    showNotification('Custom schema cannot be empty when selected', 'error');
    return;
  }

  if (!useDefaultSchema) {
    try {
      const parsed = JSON.parse(customSchema);
      if (typeof parsed !== 'object' || Array.isArray(parsed)) {
        showNotification('Schema must be a valid JSON object', 'error');
        return;
      }
    } catch (error) {
      showNotification(`Invalid schema JSON: ${error.message}`, 'error');
      return;
    }
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
    useDefaultPrompt,
    customSchema,
    useDefaultSchema
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
    useDefaultPrompt: true,
    customSchema: '',
    useDefaultSchema: true
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

// ============= DESCRIBE PROMPTS MANAGEMENT =============

/**
 * Load and display describe prompts
 */
async function loadDescribePrompts() {
  const prompts = await Storage.getDescribePrompts();
  describePromptsList.innerHTML = '';

  if (prompts.length === 0) {
    describePromptsList.innerHTML = '<p class="help-text">No describe prompts yet. Add one to get started!</p>';
    return;
  }

  prompts.forEach(prompt => {
    const promptElement = createPromptElement(prompt);
    describePromptsList.appendChild(promptElement);
  });
}

/**
 * Create a prompt element
 * @param {Object} prompt - Prompt data
 * @returns {HTMLElement} Prompt element
 */
function createPromptElement(prompt) {
  const div = document.createElement('div');
  div.className = `prompt-item ${prompt.enabled ? '' : 'disabled'}`;
  div.dataset.id = prompt.id;

  const truncatedPrompt = prompt.prompt.length > 100
    ? prompt.prompt.substring(0, 100) + '...'
    : prompt.prompt;

  div.innerHTML = `
    <div class="prompt-info-display">
      <h3>${escapeHtml(prompt.name)}</h3>
      <p>${escapeHtml(truncatedPrompt)}</p>
    </div>
    <div class="prompt-actions">
      <div class="prompt-toggle">
        <label class="toggle-switch">
          <input type="checkbox" ${prompt.enabled ? 'checked' : ''} data-id="${prompt.id}">
          <span class="toggle-slider"></span>
        </label>
      </div>
      <button class="icon-button edit" data-id="${prompt.id}" title="Edit">
        <i data-lucide="pencil"></i>
      </button>
      <button class="icon-button delete" data-id="${prompt.id}" title="Delete">
        <i data-lucide="trash-2"></i>
      </button>
    </div>
  `;

  // Add event listeners
  const toggleCheckbox = div.querySelector('input[type="checkbox"]');
  toggleCheckbox.addEventListener('change', () => togglePromptEnabled(prompt.id, toggleCheckbox.checked));

  const editBtn = div.querySelector('.edit');
  editBtn.addEventListener('click', () => openEditPromptModal(prompt.id));

  const deleteBtn = div.querySelector('.delete');
  deleteBtn.addEventListener('click', () => deleteDescribePromptConfirm(prompt.id));

  // Initialize Lucide icons for this element
  if (window.lucide) {
    window.lucide.createIcons({ nameAttr: 'data-lucide' });
  }

  return div;
}

/**
 * Escape HTML
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Toggle prompt enabled status
 * @param {string} id - Prompt ID
 * @param {boolean} enabled - Enabled status
 */
async function togglePromptEnabled(id, enabled) {
  const success = await Storage.updateDescribePrompt(id, { enabled });
  if (success) {
    await loadDescribePrompts();
    await refreshContextMenu();
    showNotification(`Prompt ${enabled ? 'enabled' : 'disabled'}`, 'success');
  } else {
    showNotification('Failed to update prompt', 'error');
    await loadDescribePrompts();
  }
}

/**
 * Open add prompt modal
 */
function openAddPromptModal() {
  currentEditingPromptId = null;
  promptModalTitle.textContent = 'Add Describe Prompt';
  promptNameInput.value = '';
  promptTextInput.value = '';
  promptEnabledCheckbox.checked = true;
  describePromptModal.classList.remove('hidden');
}

/**
 * Open edit prompt modal
 * @param {string} id - Prompt ID
 */
async function openEditPromptModal(id) {
  const prompts = await Storage.getDescribePrompts();
  const prompt = prompts.find(p => p.id === id);

  if (!prompt) {
    showNotification('Prompt not found', 'error');
    return;
  }

  currentEditingPromptId = id;
  promptModalTitle.textContent = 'Edit Describe Prompt';
  promptNameInput.value = prompt.name;
  promptTextInput.value = prompt.prompt;
  promptEnabledCheckbox.checked = prompt.enabled;
  describePromptModal.classList.remove('hidden');
}

/**
 * Close prompt modal
 */
function closePromptModal() {
  describePromptModal.classList.add('hidden');
  currentEditingPromptId = null;
}

/**
 * Save describe prompt
 */
async function saveDescribePrompt() {
  const name = promptNameInput.value.trim();
  const promptText = promptTextInput.value.trim();
  const enabled = promptEnabledCheckbox.checked;

  if (!name) {
    showNotification('Prompt name is required', 'error');
    return;
  }

  if (!promptText) {
    showNotification('Prompt text is required', 'error');
    return;
  }

  // Disable buttons during save
  savePromptBtn.disabled = true;
  cancelPromptBtn.disabled = true;

  try {
    let success;

    if (currentEditingPromptId) {
      // Update existing prompt
      success = await Storage.updateDescribePrompt(currentEditingPromptId, {
        name,
        prompt: promptText,
        enabled
      });
    } else {
      // Add new prompt
      success = await Storage.addDescribePrompt({
        name,
        prompt: promptText,
        enabled
      });
    }

    if (success) {
      await loadDescribePrompts();
      await refreshContextMenu();
      closePromptModal();
      showNotification(
        currentEditingPromptId ? 'Prompt updated successfully' : 'Prompt added successfully',
        'success'
      );
    } else {
      showNotification('Failed to save prompt', 'error');
    }
  } finally {
    // Re-enable buttons
    savePromptBtn.disabled = false;
    cancelPromptBtn.disabled = false;
  }
}

/**
 * Delete describe prompt with confirmation
 * @param {string} id - Prompt ID
 */
async function deleteDescribePromptConfirm(id) {
  const prompts = await Storage.getDescribePrompts();
  const prompt = prompts.find(p => p.id === id);

  if (!prompt) {
    showNotification('Prompt not found', 'error');
    return;
  }

  if (!confirm(`Delete prompt "${prompt.name}"? This cannot be undone.`)) {
    return;
  }

  const success = await Storage.deleteDescribePrompt(id);

  if (success) {
    await loadDescribePrompts();
    await refreshContextMenu();
    showNotification('Prompt deleted successfully', 'success');
  } else {
    showNotification('Failed to delete prompt', 'error');
  }
}

/**
 * Refresh context menu after prompts change
 */
async function refreshContextMenu() {
  try {
    await chrome.runtime.sendMessage({ action: 'refreshContextMenu' });
  } catch (error) {
    console.error('Failed to refresh context menu:', error);
  }
}

// Initialize Lucide icons
function initLucideIcons() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initLucideIcons();
    init();
  });
} else {
  initLucideIcons();
  init();
}
