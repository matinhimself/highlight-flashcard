/**
 * Popup logic for Lexis Extension
 */

import Storage from '../lib/storage.js';

// DOM elements
let loadingModal;
let successModal;

// Initialize popup
async function init() {
  // Get DOM elements
  loadingModal = document.getElementById('loadingModal');
  successModal = document.getElementById('successModal');

  await loadCounts();
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
 * Set up event listeners
 */
function setupEventListeners() {
  const settingsBtn = document.getElementById('settingsBtn');
  settingsBtn.addEventListener('click', openSettings);

  const viewFlashcardsBtn = document.getElementById('viewFlashcardsBtn');
  viewFlashcardsBtn.addEventListener('click', openFlashcards);

  const closeSuccessBtn = document.getElementById('closeSuccessBtn');
  closeSuccessBtn.addEventListener('click', closeSuccessModal);
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
  window.location.href = 'flashcards.html';
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
