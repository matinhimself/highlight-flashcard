/**
 * Highlights notebook viewer logic
 */

import Storage from '../lib/storage.js';

// DOM elements
let highlightsCount;
let searchInput;
let clearSearchBtn;
let tagDropdown;
let tagToggle;
let tagMenu;
let tagItems;
let tagSearch;
let sortDropdown;
let sortToggle;
let sortMenu;
let emptyState;
let highlightsList;
let loadMoreContainer;
let loadMoreBtn;
let settingsBtn;
let flashcardsBtn;
let editModal;
let deleteModal;

// State
let allHighlights = [];
let filteredHighlights = [];
let allTags = [];
let displayedCount = 0;
const ITEMS_PER_PAGE = 20;
let currentEditingId = null;
let currentDeletingId = null;
let searchDebounceTimer = null;
let selectedTag = 'all';
let selectedSort = 'newest';

/**
 * Initialize the highlights page
 */
async function init() {
  // Get DOM elements
  highlightsCount = document.getElementById('highlightsCount');
  searchInput = document.getElementById('searchInput');
  clearSearchBtn = document.getElementById('clearSearch');
  tagDropdown = document.getElementById('tagDropdown');
  tagToggle = document.getElementById('tagToggle');
  tagMenu = document.getElementById('tagMenu');
  tagItems = document.getElementById('tagItems');
  tagSearch = document.getElementById('tagSearch');
  sortDropdown = document.getElementById('sortDropdown');
  sortToggle = document.getElementById('sortToggle');
  sortMenu = document.getElementById('sortMenu');
  emptyState = document.getElementById('emptyState');
  highlightsList = document.getElementById('highlightsList');
  loadMoreContainer = document.getElementById('loadMoreContainer');
  loadMoreBtn = document.getElementById('loadMoreBtn');
  settingsBtn = document.getElementById('settingsBtn');
  flashcardsBtn = document.getElementById('flashcardsBtn');
  editModal = document.getElementById('editModal');
  deleteModal = document.getElementById('deleteModal');

  // Set up event listeners
  setupEventListeners();

  // Load highlights with loading indicator
  await loadHighlights(true);

  // Load tags after highlights are loaded
  await loadTagsDropdown();
}

/**
 * Set up event listeners
 */
function setupEventListeners() {
  // Search
  searchInput.addEventListener('input', () => {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      const query = searchInput.value.trim();
      if (query === '') {
        clearSearchBtn.classList.add('hidden');
      } else {
        clearSearchBtn.classList.remove('hidden');
      }
      applyFiltersAndSort();
      updateCount();
      renderHighlights();
    }, 300);
  });

  clearSearchBtn.addEventListener('click', clearSearch);

  // Custom dropdowns
  setupCustomDropdown(tagToggle, tagMenu);
  setupCustomDropdown(sortToggle, sortMenu);

  // Tag search
  tagSearch.addEventListener('input', filterTagsDropdown);

  // Navigation buttons
  settingsBtn.addEventListener('click', openSettings);
  flashcardsBtn.addEventListener('click', openFlashcards);

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
 * Load highlights from storage
 */
async function loadHighlights(showLoading = false) {
  if (showLoading) {
    showSkeletonCards();
  }

  allHighlights = await Storage.getHighlights();
  applyFiltersAndSort();
  updateCount();
  renderHighlights();
}

/**
 * Show skeleton loading cards
 */
function showSkeletonCards() {
  highlightsList.innerHTML = '';
  emptyState.classList.add('hidden');

  for (let i = 0; i < 3; i++) {
    const skeleton = document.createElement('div');
    skeleton.className = 'highlight-skeleton';
    skeleton.innerHTML = `
      <div class="skeleton skeleton-header"></div>
      <div class="skeleton skeleton-text"></div>
      <div class="skeleton skeleton-description"></div>
      <div class="skeleton skeleton-meta"></div>
    `;
    highlightsList.appendChild(skeleton);
  }
}

/**
 * Update highlights count
 */
function updateCount() {
  highlightsCount.textContent = filteredHighlights.length;
}

/**
 * Apply filters and sorting
 */
function applyFiltersAndSort() {
  // Start with all highlights
  filteredHighlights = [...allHighlights];

  // Apply tag filter
  if (selectedTag !== 'all') {
    filteredHighlights = filteredHighlights.filter(h =>
      h.tags && h.tags.includes(selectedTag)
    );
  }

  // Apply search if active
  const query = searchInput.value.trim();
  if (query !== '') {
    const lowerQuery = query.toLowerCase();
    filteredHighlights = filteredHighlights.filter(h => {
      const matchesText = h.text.toLowerCase().includes(lowerQuery) ||
        (h.description && h.description.toLowerCase().includes(lowerQuery)) ||
        (h.sourceUrl && h.sourceUrl.toLowerCase().includes(lowerQuery)) ||
        (h.sourceTitle && h.sourceTitle.toLowerCase().includes(lowerQuery));

      const matchesTags = h.tags && h.tags.some(tag =>
        tag.toLowerCase().includes(lowerQuery)
      );

      return matchesText || matchesTags;
    });
  }

  // Apply sort
  switch (selectedSort) {
    case 'newest':
      filteredHighlights.sort((a, b) => b.createdAt - a.createdAt);
      break;
    case 'oldest':
      filteredHighlights.sort((a, b) => a.createdAt - b.createdAt);
      break;
  }
}

/**
 * Render highlights
 * @param {boolean} append - Whether to append or replace
 */
function renderHighlights(append = false) {
  if (filteredHighlights.length === 0) {
    emptyState.classList.remove('hidden');
    highlightsList.innerHTML = '';
    loadMoreContainer.classList.add('hidden');
    return;
  }

  emptyState.classList.add('hidden');

  if (!append) {
    highlightsList.innerHTML = '';
    displayedCount = 0;
  }

  const start = displayedCount;
  const end = Math.min(displayedCount + ITEMS_PER_PAGE, filteredHighlights.length);

  for (let i = start; i < end; i++) {
    const highlight = filteredHighlights[i];
    const highlightElement = createHighlightElement(highlight);
    highlightsList.appendChild(highlightElement);
  }

  displayedCount = end;

  // Show/hide load more button
  if (displayedCount < filteredHighlights.length) {
    loadMoreContainer.classList.remove('hidden');
  } else {
    loadMoreContainer.classList.add('hidden');
  }
}

/**
 * Create a highlight DOM element
 * @param {Object} highlight - Highlight data
 * @returns {HTMLElement} Highlight element
 */
function createHighlightElement(highlight) {
  const card = document.createElement('div');
  card.className = `highlight-card ${highlight.type}`;
  card.dataset.id = highlight.id;

  // Format date
  const date = new Date(highlight.createdAt);
  const formattedDate = formatDate(date);

  // Extract domain from URL
  const domain = extractDomain(highlight.sourceUrl);

  // Type badge
  const typeBadge = highlight.type === 'described'
    ? '<span class="highlight-type described">📝 Described</span>'
    : '<span class="highlight-type simple">📌 Simple</span>';

  // Description section (only for described highlights)
  const descriptionHtml = highlight.description
    ? `<div class="highlight-description">${formatDescription(highlight.description)}</div>`
    : '';

  // Tags section (only if tags exist)
  const tagsHtml = highlight.tags && highlight.tags.length > 0
    ? `<div class="highlight-tags">
        ${highlight.tags.map(tag => `<span class="tag clickable-tag" data-tag="${escapeHtml(tag)}">#${escapeHtml(tag)}</span>`).join('')}
      </div>`
    : '';

  // Meta information
  const metaItems = [
    `<div class="meta-item">
      <span>📅 ${formattedDate}</span>
    </div>`,
    `<div class="meta-item">
      <a href="${escapeHtml(highlight.sourceUrl)}" target="_blank" title="${escapeHtml(highlight.sourceUrl)}">
        🔗 ${escapeHtml(highlight.sourceTitle || domain)}
      </a>
    </div>`
  ];

  if (highlight.promptName) {
    metaItems.push(`<span class="prompt-badge">💡 ${escapeHtml(highlight.promptName)}</span>`);
  }

  if (highlight.model) {
    const modelName = highlight.model.split('/').pop();
    metaItems.push(`<span class="model-badge">🤖 ${escapeHtml(modelName)}</span>`);
  }

  card.innerHTML = `
    <div class="highlight-header">
      ${typeBadge}
      <div class="highlight-actions">
        <button class="edit-btn action-icon-btn" data-id="${highlight.id}" title="Edit">
          <img src="icons/pencil.svg" class="icon" alt="Edit">
        </button>
        <button class="delete-btn action-icon-btn" data-id="${highlight.id}" title="Delete">
          <img src="icons/trash-2.svg" class="icon" alt="Delete">
        </button>
      </div>
    </div>
    <div class="highlight-content">
      <div class="highlight-text">${escapeHtml(highlight.text)}</div>
      ${descriptionHtml}
      ${tagsHtml}
    </div>
    <div class="highlight-meta">
      ${metaItems.join('')}
    </div>
  `;

  // Add event listeners
  card.querySelector('.edit-btn').addEventListener('click', () => openEditModal(highlight.id));
  card.querySelector('.delete-btn').addEventListener('click', () => openDeleteModal(highlight.id));

  // Add click listeners to tags
  const tagElements = card.querySelectorAll('.clickable-tag');
  tagElements.forEach(tagEl => {
    tagEl.addEventListener('click', () => {
      const tag = tagEl.dataset.tag;
      handleTagClick(tag);
    });
  });

  return card;
}

/**
 * Format description with markdown-like formatting
 * @param {string} text - Description text
 * @returns {string} Formatted HTML
 */
function formatDescription(text) {
  let formatted = escapeHtml(text);

  // Headers (## Header)
  formatted = formatted.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  formatted = formatted.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  formatted = formatted.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // Bold text **text**
  formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // Italic text *text*
  formatted = formatted.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');

  // Code blocks ```code```
  formatted = formatted.replace(/```([\s\S]+?)```/g, '<pre><code>$1</code></pre>');

  // Inline code `code`
  formatted = formatted.replace(/`(.+?)`/g, '<code>$1</code>');

  // Bullet lists
  formatted = formatted.replace(/^- (.+)$/gm, '<li>$1</li>');
  formatted = formatted.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');

  // Numbered lists
  formatted = formatted.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
  formatted = formatted.replace(/(<li>.*<\/li>\n?)+/g, match => {
    if (!match.includes('<ul>')) {
      return '<ol>' + match + '</ol>';
    }
    return match;
  });

  // Paragraphs (double newline)
  formatted = formatted.split('\n\n').map(para => {
    para = para.trim();
    if (!para.startsWith('<') && para.length > 0) {
      return '<p>' + para.replace(/\n/g, '<br>') + '</p>';
    }
    return para;
  }).join('\n');

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
  } else {
    clearSearchBtn.classList.remove('hidden');
  }

  applyFiltersAndSort();
  updateCount();
  renderHighlights();
}

/**
 * Clear search
 */
function clearSearch() {
  searchInput.value = '';
  clearSearchBtn.classList.add('hidden');
  applyFiltersAndSort();
  updateCount();
  renderHighlights();
}

/**
 * Set up custom dropdown
 * @param {HTMLElement} toggle - Toggle button
 * @param {HTMLElement} menu - Dropdown menu
 */
function setupCustomDropdown(toggle, menu) {
  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = !menu.classList.contains('hidden');

    // Close all other dropdowns
    document.querySelectorAll('.dropdown-menu').forEach(m => {
      if (m !== menu) m.classList.add('hidden');
    });

    // Toggle this dropdown
    if (isOpen) {
      menu.classList.add('hidden');
    } else {
      menu.classList.remove('hidden');
    }
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', () => {
    menu.classList.add('hidden');
  });

  // Prevent closing when clicking inside menu
  menu.addEventListener('click', (e) => {
    e.stopPropagation();
  });
}

/**
 * Load tags into dropdown
 */
async function loadTagsDropdown() {
  allTags = await Storage.getAllTags();

  // Build dropdown items
  tagItems.innerHTML = `
    <div class="dropdown-item active" data-value="all">All Tags</div>
    ${allTags.map(tag => `
      <div class="dropdown-item" data-value="${escapeHtml(tag)}">
        <span class="tag-count">#</span>${escapeHtml(tag)}
      </div>
    `).join('')}
  `;

  // Add click listeners
  tagItems.querySelectorAll('.dropdown-item').forEach(item => {
    item.addEventListener('click', () => handleTagSelect(item.dataset.value));
  });

  // Set up sort dropdown listeners
  sortMenu.querySelectorAll('.dropdown-item').forEach(item => {
    item.addEventListener('click', () => handleSortSelect(item.dataset.value));
  });
}

/**
 * Filter tags in dropdown search
 */
function filterTagsDropdown() {
  const query = tagSearch.value.toLowerCase().trim();
  const items = tagItems.querySelectorAll('.dropdown-item');

  items.forEach(item => {
    const tag = item.dataset.value.toLowerCase();
    if (tag === 'all' || tag.includes(query)) {
      item.style.display = '';
    } else {
      item.style.display = 'none';
    }
  });
}

/**
 * Handle tag selection from dropdown
 * @param {string} tag - Selected tag value
 */
function handleTagSelect(tag) {
  selectedTag = tag;

  // Update dropdown label
  const label = tagToggle.querySelector('.dropdown-label');
  label.textContent = tag === 'all' ? 'All Tags' : `#${tag}`;

  // Update active state
  tagItems.querySelectorAll('.dropdown-item').forEach(item => {
    item.classList.toggle('active', item.dataset.value === tag);
  });

  // Close dropdown
  tagMenu.classList.add('hidden');

  // Apply filter
  applyFiltersAndSort();
  updateCount();
  renderHighlights();
}

/**
 * Handle tag click from highlight card
 * @param {string} tag - Tag that was clicked
 */
function handleTagClick(tag) {
  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Select the tag in dropdown and filter
  handleTagSelect(tag);
}

/**
 * Handle sort selection
 * @param {string} sort - Sort value
 */
function handleSortSelect(sort) {
  selectedSort = sort;

  // Update dropdown label
  const label = sortToggle.querySelector('.dropdown-label');
  const sortLabels = {
    'newest': 'Newest First',
    'oldest': 'Oldest First'
  };
  label.textContent = sortLabels[sort] || 'Newest First';

  // Update active state
  sortMenu.querySelectorAll('.dropdown-item').forEach(item => {
    item.classList.toggle('active', item.dataset.value === sort);
  });

  // Close dropdown
  sortMenu.classList.add('hidden');

  // Apply sort
  applyFiltersAndSort();
  renderHighlights();
}

/**
 * Load more highlights
 */
function loadMore() {
  renderHighlights(true);
}

/**
 * Open settings page
 */
function openSettings() {
  chrome.runtime.openOptionsPage();
}

/**
 * Open flashcards page
 */
function openFlashcards() {
  window.location.href = 'flashcards.html';
}

/**
 * Open edit modal
 * @param {string} id - Highlight ID
 */
async function openEditModal(id) {
  currentEditingId = id;
  const highlights = await Storage.getHighlights();
  const highlight = highlights.find(h => h.id === id);

  if (!highlight) {
    console.error('Highlight not found:', id);
    return;
  }

  document.getElementById('editText').value = highlight.text;
  document.getElementById('editDescription').value = highlight.description || '';
  document.getElementById('editSource').value = highlight.sourceUrl;
  document.getElementById('editSourceTitle').value = highlight.sourceTitle || '';

  // Show/hide description field based on type
  const descriptionGroup = document.getElementById('descriptionGroup');
  if (highlight.type === 'simple') {
    descriptionGroup.style.display = 'none';
  } else {
    descriptionGroup.style.display = 'block';
  }

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

  const text = document.getElementById('editText').value.trim();
  const description = document.getElementById('editDescription').value.trim();
  const sourceUrl = document.getElementById('editSource').value.trim();
  const sourceTitle = document.getElementById('editSourceTitle').value.trim();

  if (!text) {
    alert('Highlighted text is required');
    return;
  }

  // Show loading state
  const saveButton = document.getElementById('saveEdit');
  const cancelButton = document.getElementById('cancelEdit');
  const inputs = [
    document.getElementById('editText'),
    document.getElementById('editDescription'),
    document.getElementById('editSource'),
    document.getElementById('editSourceTitle')
  ];

  saveButton.classList.add('loading');
  saveButton.disabled = true;
  cancelButton.disabled = true;
  inputs.forEach(input => input.disabled = true);

  try {
    const updates = {
      text,
      sourceUrl,
      sourceTitle
    };

    // Only include description if it exists
    if (description) {
      updates.description = description;
    }

    const success = await Storage.updateHighlight(currentEditingId, updates);

    if (success) {
      closeEditModal();
      await loadHighlights();
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
 * @param {string} id - Highlight ID
 */
async function openDeleteModal(id) {
  currentDeletingId = id;
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
    const success = await Storage.deleteHighlight(currentDeletingId);

    if (success) {
      closeDeleteModal();
      await loadHighlights();
    } else {
      alert('Failed to delete highlight');
    }
  } finally {
    // Reset loading state
    deleteButton.classList.remove('loading');
    deleteButton.disabled = false;
    cancelButton.disabled = false;
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
