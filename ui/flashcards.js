/**
 * Flashcards viewer logic for Highlight Flashcard Extension
 */

import Storage from '../lib/storage.js';

// DOM elements
let flashcardCount;
let searchInput;
let clearSearchBtn;
let sortSelect;
let emptyState;
let flashcardsList;
let loadMoreContainer;
let loadMoreBtn;
let settingsBtn;
let emptySettingsBtn;
let editModal;
let deleteModal;

// State
let allFlashcards = [];
let filteredFlashcards = [];
let displayedCount = 0;
const CARDS_PER_PAGE = 20;
let currentEditingId = null;
let currentDeletingId = null;
let searchDebounceTimer = null;

/**
 * Initialize the flashcards page
 */
async function init() {
  // Get DOM elements
  flashcardCount = document.getElementById('flashcardCount');
  searchInput = document.getElementById('searchInput');
  clearSearchBtn = document.getElementById('clearSearch');
  sortSelect = document.getElementById('sortSelect');
  emptyState = document.getElementById('emptyState');
  flashcardsList = document.getElementById('flashcardsList');
  loadMoreContainer = document.getElementById('loadMoreContainer');
  loadMoreBtn = document.getElementById('loadMoreBtn');
  settingsBtn = document.getElementById('settingsBtn');
  emptySettingsBtn = document.getElementById('emptySettingsBtn');
  editModal = document.getElementById('editModal');
  deleteModal = document.getElementById('deleteModal');

  // Set up event listeners
  setupEventListeners();

  // Load flashcards
  await loadFlashcards();
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

  // Settings buttons
  settingsBtn.addEventListener('click', openSettings);
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

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Escape to close modals
    if (e.key === 'Escape') {
      closeEditModal();
      closeDeleteModal();
    }

    // Ctrl/Cmd + F to focus search
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      e.preventDefault();
      searchInput.focus();
    }
  });
}

/**
 * Load flashcards from storage
 */
async function loadFlashcards() {
  allFlashcards = await Storage.getFlashcards();
  filteredFlashcards = [...allFlashcards];

  updateCount();
  renderFlashcards();
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
  card.className = 'flashcard';
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
        <button class="edit-btn" data-id="${flashcard.id}" title="Edit">✏️</button>
        <button class="delete-btn" data-id="${flashcard.id}" title="Delete">🗑️</button>
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
  card.querySelector('.edit-btn').addEventListener('click', () => openEditModal(flashcard.id));
  card.querySelector('.delete-btn').addEventListener('click', () => openDeleteModal(flashcard.id));

  return card;
}

/**
 * Format structured data from schema
 * @param {Object} data - Structured flashcard data
 * @returns {string} Formatted HTML
 */
function formatStructuredData(data) {
  if (!data || typeof data !== 'object') {
    return escapeHtml(String(data));
  }

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
    formattedValue = formattedValue.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    formattedValue = formattedValue.replace(/\*(.+?)\*/g, '<em>$1</em>');
    formattedValue = formattedValue.replace(/\n/g, '<br>');

    html += `<div class="data-field">
      <span class="data-label">${escapeHtml(label)}:</span>
      <span class="data-value">${formattedValue}</span>
    </div>`;
  }

  return html || formatDefinition(data.definition || 'No definition available');
}

/**
 * Format definition with simple markdown-like formatting
 * @param {string} text - Definition text
 * @returns {string} Formatted HTML
 */
function formatDefinition(text) {
  let formatted = escapeHtml(text);

  // Bold text **text**
  formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // Italic text *text*
  formatted = formatted.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Line breaks
  formatted = formatted.replace(/\n/g, '<br>');

  return formatted;
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

  const success = await Storage.deleteFlashcard(currentDeletingId);

  if (success) {
    closeDeleteModal();
    await loadFlashcards();
  } else {
    alert('Failed to delete flashcard');
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
