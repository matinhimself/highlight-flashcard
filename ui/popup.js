/**
 * Popup logic for Lexis Extension
 */

import Storage from '../lib/storage.js';

// DOM elements
let loadingModal;
let flashcardsList;
let highlightsList;
let flashcardsEmpty;
let highlightsEmpty;
let previewCard;

// State
let currentTab = 'flashcards';
const MAX_POPUP_ITEMS = 8;

// Pending preview data for "Save as Flashcard" from context menu preview
let pendingPreviewText = '';
let pendingPreviewUrl = '';

// Initialize popup
async function init() {
  loadingModal = document.getElementById('loadingModal');
  flashcardsList = document.getElementById('flashcardsList');
  highlightsList = document.getElementById('highlightsList');
  flashcardsEmpty = document.getElementById('flashcardsEmpty');
  highlightsEmpty = document.getElementById('highlightsEmpty');
  previewCard = document.getElementById('previewCard');

  await loadCounts();
  await loadRecentItems();
  setupEventListeners();
  setupMessageListener();
}

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

async function loadRecentItems() {
  try {
    const flashcards = await Storage.getFlashcards();
    const recentFlashcards = flashcards.slice(0, MAX_POPUP_ITEMS);

    if (recentFlashcards.length === 0) {
      flashcardsEmpty.classList.remove('hidden');
      flashcardsList.innerHTML = '';
    } else {
      flashcardsEmpty.classList.add('hidden');
      flashcardsList.innerHTML = recentFlashcards.map(card => createFlashcardItem(card)).join('');
    }

    const highlights = await Storage.getHighlights();
    const recentHighlights = highlights.slice(0, MAX_POPUP_ITEMS);

    if (recentHighlights.length === 0) {
      highlightsEmpty.classList.remove('hidden');
      highlightsList.innerHTML = '';
    } else {
      highlightsEmpty.classList.add('hidden');
      highlightsList.innerHTML = recentHighlights.map(h => createHighlightItem(h)).join('');
    }

    attachItemListeners();
  } catch (error) {
    console.error('Error loading recent items:', error);
  }
}

/**
 * Build flashcard details HTML for expanded view
 */
function buildFlashcardDetails(flashcard) {
  const data = flashcard.data || {};
  const pos = data.partOfSpeech || '';
  const definition = data.definition || flashcard.definition || '';
  const example = data.example || '';

  let html = '<div class="item-details-inner">';
  if (pos) {
    html += `<div class="detail-field"><span class="field-label">Part of Speech</span><span class="field-value pos">${escapeHtml(pos)}</span></div>`;
  }
  if (definition) {
    html += `<div class="detail-field"><span class="field-label">Definition</span><span class="field-value">${escapeHtml(definition)}</span></div>`;
  }
  if (example) {
    html += `<div class="detail-field"><span class="field-label">Example</span><span class="field-value"><em>${escapeHtml(example)}</em></span></div>`;
  }
  html += '</div>';
  return html;
}

/**
 * Build highlight details HTML for expanded view (with chat)
 */
function buildHighlightDetails(highlight) {
  const description = highlight.description || '';
  const tags = highlight.tags && highlight.tags.length > 0
    ? highlight.tags.map(t => `<span style="background:rgba(16,185,129,0.15);border:1px solid rgba(16,185,129,0.3);padding:1px 5px;border-radius:4px;font-size:9px;color:#34d399;">#${escapeHtml(t)}</span>`).join(' ')
    : '';

  let html = '<div class="item-details-inner">';
  if (description) {
    html += `<div class="detail-field"><span class="field-label">Description</span><span class="field-value">${escapeHtml(description)}</span></div>`;
  }
  if (tags) {
    html += `<div class="detail-field" style="margin-top:4px;">${tags}</div>`;
  }
  html += '</div>';

  return html;
}

/**
 * Create flashcard list item HTML
 */
function createFlashcardItem(flashcard) {
  const date = formatDate(new Date(flashcard.createdAt));
  const source = extractDomain(flashcard.sourceUrl);
  const details = buildFlashcardDetails(flashcard);

  return `
    <div class="list-item" data-type="flashcard" data-id="${flashcard.id}" data-expanded="false">
      <div class="item-row">
        <div class="item-icon">
          <img src="icons/book-marked.svg" alt="">
        </div>
        <div class="item-content">
          <div class="item-title">${escapeHtml(flashcard.word)}</div>
          <div class="item-meta">${source} · ${date}</div>
        </div>
        <div class="item-controls">
          <button class="item-external-link" data-type="flashcard" data-id="${flashcard.id}" title="Open in full page">
            <img src="icons/external-link.svg" alt="">
          </button>
          <div class="item-expand-arrow">
            <img src="icons/chevron-down.svg" alt="">
          </div>
        </div>
      </div>
      <div class="item-details">
        ${details}
      </div>
    </div>
  `;
}

/**
 * Create highlight list item HTML
 */
function createHighlightItem(highlight) {
  const date = formatDate(new Date(highlight.createdAt));
  const source = extractDomain(highlight.sourceUrl);
  const truncatedText = highlight.text.length > 55
    ? highlight.text.substring(0, 55) + '…'
    : highlight.text;
  const typeIcon = highlight.type === 'described' ? '📝' : '📌';
  const details = buildHighlightDetails(highlight);

  return `
    <div class="list-item" data-type="highlight" data-id="${highlight.id}" data-expanded="false">
      <div class="item-row">
        <div class="item-icon type-badge">${typeIcon}</div>
        <div class="item-content">
          <div class="item-title">${escapeHtml(truncatedText)}</div>
          <div class="item-meta">${source} · ${date}</div>
        </div>
        <div class="item-controls">
          <button class="item-external-link" data-type="highlight" data-id="${highlight.id}" title="Open in full page">
            <img src="icons/external-link.svg" alt="">
          </button>
          <div class="item-expand-arrow">
            <img src="icons/chevron-down.svg" alt="">
          </div>
        </div>
      </div>
      <div class="item-details">
        ${details}
      </div>
    </div>
  `;
}

/**
 * Attach event listeners to list items
 */
function attachItemListeners() {
  // Expand/collapse on item row click
  document.querySelectorAll('.item-row').forEach(row => {
    row.addEventListener('click', (e) => {
      // Don't expand if clicking external link button
      if (e.target.closest('.item-external-link')) return;
      const item = row.closest('.list-item');
      toggleItemExpanded(item);
    });
  });

  // External link buttons
  document.querySelectorAll('.item-external-link').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const type = btn.dataset.type;
      const id = btn.dataset.id;
      openItemInFullpage(type, id);
    });
  });

}

/**
 * Toggle item expanded state
 */
function toggleItemExpanded(item) {
  const isExpanded = item.dataset.expanded === 'true';
  item.dataset.expanded = isExpanded ? 'false' : 'true';
  item.classList.toggle('expanded', !isExpanded);
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
 * Show the preview card after flashcard creation
 */
function showPreviewCard(flashcard) {
  hideLoadingModal();

  if (!flashcard) return;

  const data = flashcard.data || {};
  const word = data.word || flashcard.word || '';
  const pos = data.partOfSpeech || '';
  const definition = data.definition || flashcard.definition || '';
  const example = data.example || '';

  document.getElementById('previewWord').textContent = word;
  document.getElementById('previewPos').textContent = pos;
  document.getElementById('previewDefinition').textContent = definition;
  document.getElementById('previewExample').textContent = example ? `"${example}"` : '';

  previewCard.classList.remove('hidden');

  // Auto-dismiss after 7 seconds
  setTimeout(() => {
    if (!previewCard.classList.contains('hidden')) {
      previewCard.classList.add('hidden');
    }
  }, 7000);
}

/**
 * Show the AI preview modal (from context menu)
 */
function showPreviewModal(previewHtml, selectionText, sourceUrl) {
  pendingPreviewText = selectionText || '';
  pendingPreviewUrl = sourceUrl || '';

  document.getElementById('previewModalBody').innerHTML = previewHtml || '<p>No preview available.</p>';
  document.getElementById('previewModal').classList.remove('hidden');
}

function closePreviewModal() {
  document.getElementById('previewModal').classList.add('hidden');
  pendingPreviewText = '';
  pendingPreviewUrl = '';
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

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function extractDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return 'Unknown';
  }
}

function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.popup-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  document.querySelectorAll('.tab-panel').forEach(panel => {
    panel.classList.toggle('active', panel.id === `${tab}Panel`);
  });
}

function setupEventListeners() {
  document.querySelectorAll('.popup-tab').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  document.getElementById('openFlashcardsFullpage').addEventListener('click', () => openStudyHub('flashcards'));
  document.getElementById('openHighlightsFullpage').addEventListener('click', () => openStudyHub('highlights'));

  document.getElementById('closePreviewCard').addEventListener('click', () => {
    previewCard.classList.add('hidden');
  });

  // Preview modal buttons
  document.getElementById('closePreviewModal').addEventListener('click', closePreviewModal);
  document.getElementById('dismissPreviewBtn').addEventListener('click', closePreviewModal);
  document.getElementById('saveFromPreviewBtn').addEventListener('click', async () => {
    if (!pendingPreviewText) return;
    const btn = document.getElementById('saveFromPreviewBtn');
    btn.textContent = 'Saving…';
    btn.disabled = true;
    try {
      await chrome.runtime.sendMessage({
        action: 'createFlashcard',
        text: pendingPreviewText,
        sourceUrl: pendingPreviewUrl
      });
    } catch (e) {
      console.error('Error saving flashcard from preview:', e);
    }
    closePreviewModal();
  });
}

function setupMessageListener() {
  chrome.runtime.onMessage.addListener((message) => {
    switch (message.type) {
      case 'FLASHCARD_PROGRESS':
        updateLoadingProgress(message.step, message.status, message.text);
        break;
      case 'FLASHCARD_CREATED':
        showPreviewCard(message.flashcard);
        loadCounts();
        loadRecentItems();
        break;
      case 'FLASHCARD_ERROR':
        hideLoadingModal();
        break;
      case 'DESCRIBE_PROGRESS':
        updateLoadingProgress(message.step, message.status, message.text);
        break;
      case 'DESCRIBE_CREATED':
        hideLoadingModal();
        loadCounts();
        loadRecentItems();
        break;
      case 'DESCRIBE_ERROR':
        hideLoadingModal();
        break;
      case 'PREVIEW_RESULT':
        if (message.result && message.result.success) {
          showPreviewModal(message.result.preview, message.selectionText, message.sourceUrl);
        }
        break;
    }
  });
}

function updateLoadingProgress(step, status, text = '') {
  loadingModal.classList.remove('hidden');
  if (text) document.getElementById('loadingTitle').textContent = text;
}

function hideLoadingModal() {
  loadingModal.classList.add('hidden');
  document.getElementById('loadingTitle').textContent = 'Processing...';
}

function openStudyHub(tab = 'flashcards') {
  const url = chrome.runtime.getURL(`ui/fullpage-study.html#${tab}`);
  chrome.tabs.create({ url });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
