/**
 * Popup logic for Lexis Extension
 */

import Storage from '../lib/storage.js';

// Initialize popup
async function init() {
  await loadCounts();
  setupEventListeners();
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
