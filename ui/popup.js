/**
 * Popup logic for Lexis Extension
 */

import Storage from '../lib/storage.js';

// DOM elements
let loadingModal;
let successModal;
let flashcardsList;
let highlightsList;
let flashcardsEmpty;
let highlightsEmpty;

// State
let currentTab = 'flashcards';
const MAX_POPUP_ITEMS = 8;

// Initialize popup
async function init() {
  // Get DOM elements
  loadingModal = document.getElementById('loadingModal');
  successModal = document.getElementById('successModal');
  flashcardsList = document.getElementById('flashcardsList');
  highlightsList = document.getElementById('highlightsList');
  flashcardsEmpty = document.getElementById('flashcardsEmpty');
  highlightsEmpty = document.getElementById('highlightsEmpty');

  await loadCounts();
  await loadRecentItems();
  setupEventListeners();
  setupMessageListener();
}

/**
 * Load counts for flashcards and highlights
 */
async function loadCounts() {
  try {
    const flashcards = await Storage.getFlashcards();
    const highlights = await Storage.getHighlights();

    document.getElementById('flashcardCount').textContent = flashcards.length;
    document.getElementById('highlightsCount').textContent = highlights.length;
  } catch (error) {
    console.error('Error loading counts:', error);
  }
}

/**
 * Load recent flashcards and highlights
 */
async function loadRecentItems() {
  try {
    // Load flashcards
    const flashcards = await Storage.getFlashcards();
    const recentFlashcards = flashcards.slice(0, MAX_POPUP_ITEMS);

    if (recentFlashcards.length === 0) {
      flashcardsEmpty.classList.remove('hidden');
      flashcardsList.innerHTML = '';
    } else {
      flashcardsEmpty.classList.add('hidden');
      flashcardsList.innerHTML = recentFlashcards.map(card => createFlashcardItem(card)).join('');
    }

    // Load highlights
    const highlights = await Storage.getHighlights();
    const recentHighlights = highlights.slice(0, MAX_POPUP_ITEMS);

    if (recentHighlights.length === 0) {
      highlightsEmpty.classList.remove('hidden');
      highlightsList.innerHTML = '';
    } else {
      highlightsEmpty.classList.add('hidden');
      highlightsList.innerHTML = recentHighlights.map(highlight => createHighlightItem(highlight)).join('');
    }

    // Add click listeners to items
    attachItemClickListeners();
  } catch (error) {
    console.error('Error loading recent items:', error);
  }
}

/**
 * Create flashcard list item HTML
 */
function createFlashcardItem(flashcard) {
  const date = formatDate(new Date(flashcard.createdAt));
  return `
    <div class="list-item" data-type="flashcard" data-id="${flashcard.id}">
      <div class="item-icon">
        <img src="icons/book-marked.svg" alt="">
      </div>
      <div class="item-content">
        <div class="item-title">${escapeHtml(flashcard.word)}</div>
        <div class="item-meta">${date}</div>
      </div>
      <div class="item-arrow">
        <img src="icons/chevron-down.svg" alt="" style="transform: rotate(-90deg);">
      </div>
    </div>
  `;
}

/**
 * Create highlight list item HTML
 */
function createHighlightItem(highlight) {
  const date = formatDate(new Date(highlight.createdAt));
  const truncatedText = highlight.text.length > 60
    ? highlight.text.substring(0, 60) + '...'
    : highlight.text;
  const typeIcon = highlight.type === 'described' ? '📝' : '📌';

  return `
    <div class="list-item" data-type="highlight" data-id="${highlight.id}">
      <div class="item-icon type-badge">${typeIcon}</div>
      <div class="item-content">
        <div class="item-title">${escapeHtml(truncatedText)}</div>
        <div class="item-meta">${date}</div>
      </div>
      <div class="item-arrow">
        <img src="icons/chevron-down.svg" alt="" style="transform: rotate(-90deg);">
      </div>
    </div>
  `;
}

/**
 * Attach click listeners to list items
 */
function attachItemClickListeners() {
  document.querySelectorAll('.list-item').forEach(item => {
    item.addEventListener('click', () => {
      const type = item.dataset.type;
      const id = item.dataset.id;
      openItemInFullpage(type, id);
    });
  });
}

/**
 * Open an item in fullpage with modal
 */
function openItemInFullpage(type, id) {
  const tab = type === 'flashcard' ? 'flashcards' : 'highlights';
  const url = chrome.runtime.getURL(`ui/fullpage-study.html#${tab}?id=${id}&modal=detail`);
  chrome.tabs.create({ url });
}

/**
 * Format date as relative
 */
function formatDate(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Escape HTML
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Switch between tabs
 */
function switchTab(tab) {
  currentTab = tab;

  // Update tab buttons
  document.querySelectorAll('.popup-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });

  // Update panels
  document.querySelectorAll('.tab-panel').forEach(panel => {
    panel.classList.toggle('active', panel.id === `${tab}Panel`);
  });
}

/**
 * Set up event listeners
 */
function setupEventListeners() {
  const settingsBtn = document.getElementById('settingsBtn');
  settingsBtn.addEventListener('click', openSettings);

  const viewFlashcardsBtn = document.getElementById('viewFlashcardsBtn');
  viewFlashcardsBtn.addEventListener('click', openFlashcards);

  const closeSuccessBtn = document.getElementById('closeSuccessBtn');
  closeSuccessBtn.addEventListener('click', closeSuccessModal);

  // Tab switching
  document.querySelectorAll('.popup-tab').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Open fullpage buttons
  document.getElementById('openFlashcardsFullpage').addEventListener('click', () => {
    openStudyHub('flashcards');
  });

  document.getElementById('openHighlightsFullpage').addEventListener('click', () => {
    openStudyHub('highlights');
  });
}

/**
 * Set up message listener for background script communications
 */
function setupMessageListener() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Popup received message:', message);

    switch (message.type) {
      case 'FLASHCARD_PROGRESS':
        updateLoadingProgress(message.step, message.status, message.text);
        break;
      case 'FLASHCARD_CREATED':
        showSuccessModal();
        loadCounts(); // Refresh counts
        loadRecentItems(); // Refresh items list
        break;
      case 'FLASHCARD_ERROR':
        hideLoadingModal();
        break;
    }
  });
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
 * Show success modal
 */
function showSuccessModal() {
  hideLoadingModal();
  successModal.classList.remove('hidden');
}

/**
 * Close success modal
 */
function closeSuccessModal() {
  successModal.classList.add('hidden');
}

/**
 * Open flashcards page
 */
function openFlashcards() {
  openStudyHub('flashcards');
}

/**
 * Open fullpage study hub
 */
function openStudyHub(tab = 'flashcards') {
  const url = chrome.runtime.getURL(`ui/fullpage-study.html#${tab}`);
  chrome.tabs.create({ url });
}

/**
 * Open settings page
 */
function openSettings() {
  chrome.runtime.openOptionsPage();
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
