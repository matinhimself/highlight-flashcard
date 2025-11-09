/**
 * Flashcards viewer logic for Highlight Flashcard Extension
 */

import Storage from '../lib/storage.js';

// DOM elements
let flashcardCount;
let searchInput;
let clearSearchBtn;
let sortSelect;
let exportBtn;
let emptyState;
let flashcardsList;
let loadMoreContainer;
let loadMoreBtn;
let settingsBtn;
let highlightsBtn;
let emptySettingsBtn;
let editModal;
let deleteModal;
let loadingModal;
let previewModal;

// State
let allFlashcards = [];
let filteredFlashcards = [];
let displayedCount = 0;
const CARDS_PER_PAGE = 20;
let currentEditingId = null;
let currentDeletingId = null;
let searchDebounceTimer = null;
let currentTemplate = null; // Cache for current template

/**
 * Initialize the flashcards page
 */
async function init() {
  // Get DOM elements
  flashcardCount = document.getElementById('flashcardCount');
  searchInput = document.getElementById('searchInput');
  clearSearchBtn = document.getElementById('clearSearch');
  sortSelect = document.getElementById('sortSelect');
  exportBtn = document.getElementById('exportBtn');
  emptyState = document.getElementById('emptyState');
  flashcardsList = document.getElementById('flashcardsList');
  loadMoreContainer = document.getElementById('loadMoreContainer');
  loadMoreBtn = document.getElementById('loadMoreBtn');
  settingsBtn = document.getElementById('settingsBtn');
  highlightsBtn = document.getElementById('highlightsBtn');
  emptySettingsBtn = document.getElementById('emptySettingsBtn');
  editModal = document.getElementById('editModal');
  deleteModal = document.getElementById('deleteModal');
  loadingModal = document.getElementById('loadingModal');
  previewModal = document.getElementById('previewModal');

  // Set up event listeners
  setupEventListeners();

  // Set up message listener for background script
  setupMessageListener();

  // Load flashcards with loading indicator
  await loadFlashcards(true);
}

/**
 * Set up event listeners
 */
function setupEventListeners() {
  // Search
  searchInput.addEventListener('input', () => {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(handleSearch, 300);
  });

  clearSearchBtn.addEventListener('click', clearSearch);

  // Sort
  sortSelect.addEventListener('change', handleSort);

  exportBtn.addEventListener('click', exportToAnki);

  settingsBtn.addEventListener('click', openSettings);
  highlightsBtn.addEventListener('click', openHighlights);
  emptySettingsBtn.addEventListener('click', openSettings);

  // Load more
  loadMoreBtn.addEventListener('click', loadMore);

  // Edit modal
  document.getElementById('closeModal').addEventListener('click', closeEditModal);
  document.getElementById('cancelEdit').addEventListener('click', closeEditModal);
  document.getElementById('saveEdit').addEventListener('click', saveEdit);

  // Delete modal
  document.getElementById('closeDeleteModal').addEventListener('click', closeDeleteModal);
  document.getElementById('cancelDelete').addEventListener('click', closeDeleteModal);
  document.getElementById('confirmDelete').addEventListener('click', confirmDelete);

  // Preview modal
  document.getElementById('closePreviewModal').addEventListener('click', closePreviewModal);
  document.getElementById('closePreview').addEventListener('click', closePreviewModal);

  // Close modal on background click
  editModal.addEventListener('click', (e) => {
    if (e.target === editModal) {
      closeEditModal();
    }
  });

  deleteModal.addEventListener('click', (e) => {
    if (e.target === deleteModal) {
      closeDeleteModal();
    }
  });

  previewModal.addEventListener('click', (e) => {
    if (e.target === previewModal) {
      closePreviewModal();
    }
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Escape to close modals
    if (e.key === 'Escape') {
      closeEditModal();
      closeDeleteModal();
      closePreviewModal();
    }

    // Ctrl/Cmd + F to focus search
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      e.preventDefault();
      searchInput.focus();
    }
  });
}

/**
 * Set up message listener for background script communications
 */
function setupMessageListener() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Received message:', message);

    switch (message.type) {
      case 'FLASHCARD_PROGRESS':
        updateLoadingProgress(message.step, message.status, message.text);
        break;
      case 'FLASHCARD_CREATED':
        showFlashcardPreview(message.flashcard);
        break;
      case 'FLASHCARD_ERROR':
        hideLoadingModal();
        showNotification('error', message.error || 'Failed to create flashcard');
        break;
    }
  });
}

/**
 * Load flashcards from storage
 */
async function loadFlashcards(showLoading = false) {
  if (showLoading) {
    showSkeletonCards();
  }

  // Load flashcards and template settings
  allFlashcards = await Storage.getFlashcards();
  filteredFlashcards = [...allFlashcards];

  // Load current template setting
  const settings = await Storage.getSettings();
  currentTemplate = settings.useDefaultTemplate
    ? Storage.getDefaultTemplate()
    : (settings.customTemplate || Storage.getDefaultTemplate());

  updateCount();
  renderFlashcards();
}

/**
 * Show skeleton loading cards
 */
function showSkeletonCards() {
  flashcardsList.innerHTML = '';
  emptyState.classList.add('hidden');

  for (let i = 0; i < 3; i++) {
    const skeleton = document.createElement('div');
    skeleton.className = 'flashcard skeleton-card';
    skeleton.innerHTML = `
      <div class="flashcard-header">
        <div class="flashcard-word skeleton"></div>
      </div>
      <div class="flashcard-definition skeleton"></div>
      <div class="flashcard-meta skeleton"></div>
    `;
    flashcardsList.appendChild(skeleton);
  }
}

/**
 * Update flashcard count
 */
function updateCount() {
  flashcardCount.textContent = filteredFlashcards.length;
}

/**
 * Render flashcards
 * @param {boolean} append - Whether to append or replace
 */
function renderFlashcards(append = false) {
  if (filteredFlashcards.length === 0) {
    emptyState.classList.remove('hidden');
    flashcardsList.innerHTML = '';
    loadMoreContainer.classList.add('hidden');
    return;
  }

  emptyState.classList.add('hidden');

  if (!append) {
    flashcardsList.innerHTML = '';
    displayedCount = 0;
  }

  const start = displayedCount;
  const end = Math.min(displayedCount + CARDS_PER_PAGE, filteredFlashcards.length);

  for (let i = start; i < end; i++) {
    const card = filteredFlashcards[i];
    const cardElement = createFlashcardElement(card);
    flashcardsList.appendChild(cardElement);
  }

  displayedCount = end;

  // Show/hide load more button
  if (displayedCount < filteredFlashcards.length) {
    loadMoreContainer.classList.remove('hidden');
  } else {
    loadMoreContainer.classList.add('hidden');
  }
}

/**
 * Create a flashcard DOM element
 * @param {Object} flashcard - Flashcard data
 * @returns {HTMLElement} Flashcard element
 */
function createFlashcardElement(flashcard) {
  const card = document.createElement('div');
  card.className = 'flashcard collapsed';
  card.dataset.id = flashcard.id;

  // Format flashcard content - handle structured data or plain definition
  const formattedDefinition = flashcard.data
    ? formatStructuredData(flashcard.data)
    : formatDefinition(flashcard.definition);

  // Format date
  const date = new Date(flashcard.createdAt);
  const formattedDate = formatDate(date);

  // Extract domain from URL
  const domain = extractDomain(flashcard.sourceUrl);

  card.innerHTML = `
    <div class="flashcard-header">
      <div class="flashcard-word">${escapeHtml(flashcard.word)}</div>
      <div class="flashcard-actions">
        <button class="expand-btn" data-id="${flashcard.id}" title="Expand">
          <i data-lucide="chevron-down"></i>
        </button>
        <button class="edit-btn" data-id="${flashcard.id}" title="Edit">
          <i data-lucide="pencil"></i>
        </button>
        <button class="delete-btn" data-id="${flashcard.id}" title="Delete">
          <i data-lucide="trash-2"></i>
        </button>
      </div>
    </div>
    <div class="flashcard-definition">${formattedDefinition}</div>
    <div class="flashcard-meta">
      <div class="flashcard-source">
        <span>Source:</span>
        <a href="${escapeHtml(flashcard.sourceUrl)}" target="_blank" title="${escapeHtml(flashcard.sourceUrl)}">
          ${escapeHtml(domain)}
        </a>
      </div>
      <div class="flashcard-date">${formattedDate}</div>
    </div>
  `;

  // Add event listeners
  card.querySelector('.expand-btn').addEventListener('click', () => toggleFlashcard(card));
  card.querySelector('.edit-btn').addEventListener('click', () => openEditModal(flashcard.id));
  card.querySelector('.delete-btn').addEventListener('click', () => openDeleteModal(flashcard.id));

  // Initialize Lucide icons for this card
  if (window.lucide) {
    window.lucide.createIcons({ nameAttr: 'data-lucide' });
  }

  return card;
}

/**
 * Toggle flashcard expand/collapse
 * @param {HTMLElement} card - Flashcard element
 */
function toggleFlashcard(card) {
  card.classList.toggle('collapsed');

  // Re-initialize Lucide icons to update the chevron
  if (window.lucide) {
    window.lucide.createIcons({ nameAttr: 'data-lucide' });
  }
}

/**
 * Format structured data from schema using custom template
 * @param {Object} data - Structured flashcard data
 * @param {string} template - Optional custom template to use (defaults to currentTemplate)
 * @returns {string} Formatted HTML
 */
function formatStructuredData(data, template = null) {
  if (!data || typeof data !== 'object') {
    return escapeHtml(String(data));
  }

  // Use provided template or fall back to currentTemplate or default
  const activeTemplate = template || currentTemplate || Storage.getDefaultTemplate();

  // Render template with data variables
  const rendered = Storage.renderTemplate(activeTemplate, data);

  // If template rendering succeeded, apply markdown formatting
  if (rendered && rendered.trim()) {
    return applyMarkdownFormatting(rendered);
  }

  // Fallback to field-by-field display if template fails
  return formatStructuredDataFallback(data);
}

/**
 * Fallback: Format structured data field-by-field (original implementation)
 * @param {Object} data - Structured flashcard data
 * @returns {string} Formatted HTML
 */
function formatStructuredDataFallback(data) {
  let html = '';

  // Iterate through all fields in the data
  for (const [key, value] of Object.entries(data)) {
    if (!value) continue; // Skip empty fields

    // Format key as label (convert camelCase to Title Case)
    const label = key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();

    // Format value
    let formattedValue = escapeHtml(String(value));

    // Apply markdown-like formatting
    formattedValue = applyMarkdownFormatting(formattedValue);

    html += `<div class="data-field">
      <span class="data-label">${escapeHtml(label)}:</span>
      <span class="data-value">${formattedValue}</span>
    </div>`;
  }

  return html || applyMarkdownFormatting(data.definition || 'No definition available');
}

/**
 * Apply markdown formatting to text
 * Supports: bold, italic, headings, lists, code, line breaks
 * @param {string} text - Text to format
 * @returns {string} Formatted HTML
 */
function applyMarkdownFormatting(text) {
  if (!text) return '';

  let formatted = escapeHtml(text);

  // Headings (must be on their own line)
  // ### Heading 3
  formatted = formatted.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  // ## Heading 2
  formatted = formatted.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  // # Heading 1
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
  formatted = formatted.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');

  // Ordered lists - items (lines starting with number.)
  formatted = formatted.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

  // Links [text](url)
  formatted = formatted.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');

  // Line breaks (convert double newlines to paragraphs, single to <br>)
  formatted = formatted.replace(/\n\n/g, '</p><p>');
  formatted = formatted.replace(/\n/g, '<br>');

  // Wrap in paragraph if not already wrapped
  if (!formatted.startsWith('<')) {
    formatted = `<p>${formatted}</p>`;
  }

  return formatted;
}

/**
 * Format definition with markdown formatting (backward compatibility wrapper)
 * @param {string} text - Definition text
 * @returns {string} Formatted HTML
 */
function formatDefinition(text) {
  return applyMarkdownFormatting(text);
}

/**
 * Format date as relative or absolute
 * @param {Date} date - Date to format
 * @returns {string} Formatted date
 */
function formatDate(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

  // Absolute date for older items
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
  });
}

/**
 * Extract domain from URL
 * @param {string} url - Full URL
 * @returns {string} Domain
 */
function extractDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return url;
  }
}

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Handle search input
 */
async function handleSearch() {
  const query = searchInput.value.trim();

  if (query === '') {
    clearSearchBtn.classList.add('hidden');
    filteredFlashcards = [...allFlashcards];
  } else {
    clearSearchBtn.classList.remove('hidden');
    filteredFlashcards = await Storage.searchFlashcards(query);
  }

  updateCount();
  renderFlashcards();
}

/**
 * Clear search
 */
function clearSearch() {
  searchInput.value = '';
  clearSearchBtn.classList.add('hidden');
  filteredFlashcards = [...allFlashcards];
  updateCount();
  renderFlashcards();
}

/**
 * Handle sort change
 */
function handleSort() {
  const sortBy = sortSelect.value;

  switch (sortBy) {
    case 'newest':
      filteredFlashcards.sort((a, b) => b.createdAt - a.createdAt);
      break;
    case 'oldest':
      filteredFlashcards.sort((a, b) => a.createdAt - b.createdAt);
      break;
    case 'az':
      filteredFlashcards.sort((a, b) => a.word.localeCompare(b.word));
      break;
    case 'za':
      filteredFlashcards.sort((a, b) => b.word.localeCompare(a.word));
      break;
  }

  renderFlashcards();
}

/**
 * Load more flashcards
 */
function loadMore() {
  renderFlashcards(true);
}

/**
 * Open settings page
 */
function openSettings() {
  chrome.runtime.openOptionsPage();
}

/**
 * Open highlights page
 */
function openHighlights() {
  window.location.href = 'highlights.html';
}

/**
 * Open edit modal
 * @param {string} id - Flashcard ID
 */
async function openEditModal(id) {
  currentEditingId = id;
  const flashcard = await Storage.getFlashcard(id);

  if (!flashcard) {
    console.error('Flashcard not found:', id);
    return;
  }

  document.getElementById('editWord').value = flashcard.word;
  document.getElementById('editDefinition').value = flashcard.definition;
  document.getElementById('editSource').value = flashcard.sourceUrl;

  editModal.classList.remove('hidden');
}

/**
 * Close edit modal
 */
function closeEditModal() {
  editModal.classList.add('hidden');
  currentEditingId = null;
}

/**
 * Save edit
 */
async function saveEdit() {
  if (!currentEditingId) return;

  const word = document.getElementById('editWord').value.trim();
  const definition = document.getElementById('editDefinition').value.trim();
  const sourceUrl = document.getElementById('editSource').value.trim();

  if (!word || !definition) {
    alert('Word and definition are required');
    return;
  }

  // Show loading state
  const saveButton = document.getElementById('saveEdit');
  const cancelButton = document.getElementById('cancelEdit');
  const inputs = [
    document.getElementById('editWord'),
    document.getElementById('editDefinition'),
    document.getElementById('editSource')
  ];

  saveButton.classList.add('loading');
  saveButton.disabled = true;
  cancelButton.disabled = true;
  inputs.forEach(input => input.disabled = true);

  try {
    const success = await Storage.updateFlashcard(currentEditingId, {
      word,
      definition,
      sourceUrl
    });

    if (success) {
      closeEditModal();
      await loadFlashcards();
    } else {
      alert('Failed to save changes');
    }
  } finally {
    // Reset loading state
    saveButton.classList.remove('loading');
    saveButton.disabled = false;
    cancelButton.disabled = false;
    inputs.forEach(input => input.disabled = false);
  }
}

/**
 * Open delete confirmation modal
 * @param {string} id - Flashcard ID
 */
async function openDeleteModal(id) {
  currentDeletingId = id;
  const flashcard = await Storage.getFlashcard(id);

  if (!flashcard) {
    console.error('Flashcard not found:', id);
    return;
  }

  document.getElementById('deleteWord').textContent = flashcard.word;
  deleteModal.classList.remove('hidden');
}

/**
 * Close delete modal
 */
function closeDeleteModal() {
  deleteModal.classList.add('hidden');
  currentDeletingId = null;
}

/**
 * Confirm delete
 */
async function confirmDelete() {
  if (!currentDeletingId) return;

  // Show loading state
  const deleteButton = document.getElementById('confirmDelete');
  const cancelButton = document.getElementById('cancelDelete');

  deleteButton.classList.add('loading');
  deleteButton.disabled = true;
  cancelButton.disabled = true;

  try {
    const success = await Storage.deleteFlashcard(currentDeletingId);

    if (success) {
      closeDeleteModal();
      await loadFlashcards();
    } else {
      alert('Failed to delete flashcard');
    }
  } finally {
    // Reset loading state
    deleteButton.classList.remove('loading');
    deleteButton.disabled = false;
    cancelButton.disabled = false;
  }
}

/**
 * Export flashcards to Anki-compatible text format
 */
async function exportToAnki() {
  // Check if there are flashcards to export
  if (allFlashcards.length === 0) {
    alert('No flashcards to export. Create some flashcards first!');
    return;
  }

  // Show loading state
  exportBtn.classList.add('loading');
  exportBtn.disabled = true;

  try {
    // Get flashcards (use filtered if search/sort is active, otherwise all)
    const cardsToExport = filteredFlashcards.length > 0 ? filteredFlashcards : allFlashcards;

    // Create Anki-compatible text format (tab-separated)
    // Format: Front\tBack
    // Anki will create a Basic note type with these two fields
    const ankiText = cardsToExport.map(card => {
      // Front: The word/phrase
      const front = card.word;

      // Back: Definition with source URL
      // We include the source URL as additional context
      const back = `${card.definition}\n\n<div style="font-size: 0.8em; color: #666; margin-top: 10px;">Source: <a href="${card.sourceUrl}">${extractDomain(card.sourceUrl)}</a></div>`;

      // Escape tabs and newlines in the data
      // Replace actual tabs with spaces
      const escapedFront = front.replace(/\t/g, ' ');
      // For the back, we keep newlines as <br> for HTML rendering in Anki
      const escapedBack = back.replace(/\t/g, ' ');

      return `${escapedFront}\t${escapedBack}`;
    }).join('\n');

    // Add header comment with instructions
    const header = `# Anki Import File - Highlight Flashcard Extension
# Generated on ${new Date().toLocaleString()}
# Total cards: ${cardsToExport.length}
#
# Instructions:
# 1. Open Anki
# 2. Go to File > Import
# 3. Select this file
# 4. Set field separator to "Tab"
# 5. Make sure "Allow HTML in fields" is checked
# 6. Map fields: Field 1 -> Front, Field 2 -> Back
# 7. Click Import
#
# Fields: Front\tBack
#separator:tab
#html:true
#deck:Highlight Flashcards
#notetype:Basic
#tags:highlight-flashcard

`;

    const fullContent = header + ankiText;

    // Create filename with timestamp
    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `highlight-flashcards-${timestamp}.txt`;

    // Download the file
    downloadTextFile(fullContent, filename);

    // Show success message
    showNotification('success', `Successfully exported ${cardsToExport.length} flashcard${cardsToExport.length > 1 ? 's' : ''} to Anki format!`);
  } catch (error) {
    console.error('Export error:', error);
    alert('Failed to export flashcards. Please try again.');
  } finally {
    // Reset loading state
    exportBtn.classList.remove('loading');
    exportBtn.disabled = false;
  }
}

/**
 * Download text content as a file
 * @param {string} content - File content
 * @param {string} filename - File name
 */
function downloadTextFile(content, filename) {
  // Create a blob with UTF-8 encoding
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });

  // Create a temporary download link
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;

  // Trigger download
  document.body.appendChild(link);
  link.click();

  // Cleanup
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Show a temporary notification
 * @param {string} type - Notification type ('success' or 'error')
 * @param {string} message - Notification message
 */
function showNotification(type, message) {
  // Create notification element
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 20px;
    background: ${type === 'success' ? 'var(--success-color)' : 'var(--danger-color)'};
    color: white;
    border-radius: 6px;
    box-shadow: var(--shadow-lg);
    z-index: 2000;
    animation: slideIn 0.3s ease;
    max-width: 300px;
  `;

  // Add to DOM
  document.body.appendChild(notification);

  // Remove after 3 seconds
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => {
      document.body.removeChild(notification);
    }, 300);
  }, 3000);
}

/**
 * Update loading progress modal
 * @param {number} step - Step number (1-3)
 * @param {string} status - Status ('active', 'completed', or 'waiting')
 * @param {string} text - Optional loading text
 */
function updateLoadingProgress(step, status, text = '') {
  // Show loading modal if hidden
  if (loadingModal.classList.contains('hidden')) {
    loadingModal.classList.remove('hidden');
  }

  // Update step status
  for (let i = 1; i <= 3; i++) {
    const stepElement = document.getElementById(`step${i}`);
    stepElement.classList.remove('active', 'completed');

    if (i < step) {
      stepElement.classList.add('completed');
    } else if (i === step) {
      stepElement.classList.add(status);
    }
  }

  // Update step statuses with custom text based on step
  if (step === 1) {
    document.querySelector('#step1 .step-status').textContent = status === 'active' ? 'Preparing request...' : 'Ready';
  } else if (step === 2) {
    document.querySelector('#step2 .step-status').textContent = status === 'active' ? 'Generating definition...' : (status === 'completed' ? 'Complete' : 'Waiting...');
  } else if (step === 3) {
    document.querySelector('#step3 .step-status').textContent = status === 'active' ? 'Saving flashcard...' : (status === 'completed' ? 'Saved!' : 'Waiting...');
  }

  // Update loading text if provided
  if (text) {
    document.getElementById('loadingText').textContent = text;
  }
}

/**
 * Hide loading modal
 */
function hideLoadingModal() {
  loadingModal.classList.add('hidden');

  // Reset progress steps
  for (let i = 1; i <= 3; i++) {
    const stepElement = document.getElementById(`step${i}`);
    stepElement.classList.remove('active', 'completed');
  }

  // Clear loading text
  document.getElementById('loadingText').textContent = '';
}

/**
 * Show flashcard preview modal
 * @param {Object} flashcard - Created flashcard data
 */
async function showFlashcardPreview(flashcard) {
  // Hide loading modal
  hideLoadingModal();

  // Create flashcard preview HTML
  const previewContainer = document.getElementById('previewFlashcard');

  // Format flashcard content
  const formattedDefinition = flashcard.data
    ? formatStructuredData(flashcard.data)
    : formatDefinition(flashcard.definition);

  // Format date
  const date = new Date(flashcard.createdAt);
  const formattedDate = formatDate(date);

  // Extract domain from URL
  const domain = extractDomain(flashcard.sourceUrl);

  previewContainer.innerHTML = `
    <div class="flashcard-word">${escapeHtml(flashcard.word)}</div>
    <div class="flashcard-definition">${formattedDefinition}</div>
    <div class="flashcard-meta">
      <div class="flashcard-source">
        <span>Source:</span>
        <a href="${escapeHtml(flashcard.sourceUrl)}" target="_blank" title="${escapeHtml(flashcard.sourceUrl)}">
          ${escapeHtml(domain)}
        </a>
      </div>
      <div class="flashcard-date">${formattedDate}</div>
    </div>
  `;

  // Show preview modal
  previewModal.classList.remove('hidden');

  // Reload flashcards to show the new one in the list
  await loadFlashcards();
}

/**
 * Close preview modal
 */
function closePreviewModal() {
  previewModal.classList.add('hidden');
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
