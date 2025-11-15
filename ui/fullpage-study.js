/**
 * Fullpage Study Hub - Flashcards and Highlights Viewer
 * With multiple view modes: List, Card, Grid, and Detailed
 */

import Storage from '../lib/storage.js';

// ============================================
// DOM Elements
// ============================================
let flashcardsCountBadge;
let highlightsCountBadge;
let searchInput;
let clearSearchBtn;
let sortToggle;
let sortDropdown;
let tagFilterToggle;
let tagDropdown;
let tagFilterContainer;
let sourceFilterToggle;
let sourceDropdown;
let sourceFilterContainer;
let exportButton;
let settingsButton;

let flashcardsContent;
let highlightsContent;
let flashcardsContainer;
let highlightsContainer;
let flashcardsEmpty;
let highlightsEmpty;
let flashcardsLoading;
let highlightsLoading;
let pagination;
let pageInfo;
let prevPageBtn;
let nextPageBtn;

let editModal;
let deleteModal;
let detailModal;

// ============================================
// State
// ============================================
let allFlashcards = [];
let allHighlights = [];
let filteredFlashcards = [];
let filteredHighlights = [];
let currentTab = 'flashcards'; // 'flashcards' or 'highlights'
let currentViewMode = 'list'; // 'list', 'cards', 'grid', 'detailed'
let currentSort = 'newest'; // 'newest', 'oldest', 'a-z', 'z-a'
let selectedTag = ''; // For highlights filtering
let selectedSource = ''; // For highlights filtering by source URL
let searchQuery = '';
let currentPage = 1;
const ITEMS_PER_PAGE = 20;

let currentEditingId = null;
let currentEditingType = null;
let currentDeletingId = null;
let currentDeletingType = null;
let currentDetailId = null;
let currentDetailType = null;
let searchDebounceTimer = null;
let currentTemplate = null; // Cache for template settings

// ============================================
// Initialization
// ============================================
async function init() {
    console.log('Initializing Fullpage Study Hub...');

    // Get DOM elements
    getDOMElements();

    // Set up event listeners
    setupEventListeners();

    // Load saved preferences
    await loadPreferences();

    // Check URL hash for initial tab
    const hash = window.location.hash.substring(1);
    if (hash === 'flashcards' || hash === 'highlights') {
        currentTab = hash;
    }

    // Set up initial tab state (update UI without rendering)
    switchTab(currentTab, true);

    // Load data (this will render the content)
    await loadData();

    console.log('Initialization complete');
}

/**
 * Get all DOM element references
 */
function getDOMElements() {
    // Header
    flashcardsCountBadge = document.getElementById('flashcards-count');
    highlightsCountBadge = document.getElementById('highlights-count');
    settingsButton = document.querySelector('.settings-button');

    // Toolbar
    searchInput = document.getElementById('search-input');
    clearSearchBtn = document.getElementById('clear-search');
    sortToggle = document.getElementById('sort-toggle');
    sortDropdown = document.getElementById('sort-dropdown');
    tagFilterToggle = document.getElementById('tag-filter-toggle');
    tagDropdown = document.getElementById('tag-dropdown');
    tagFilterContainer = document.getElementById('tag-filter-container');
    sourceFilterToggle = document.getElementById('source-filter-toggle');
    sourceDropdown = document.getElementById('source-dropdown');
    sourceFilterContainer = document.getElementById('source-filter-container');
    exportButton = document.getElementById('export-button');

    // Content
    flashcardsContent = document.getElementById('flashcards-content');
    highlightsContent = document.getElementById('highlights-content');
    flashcardsContainer = document.getElementById('flashcards-container');
    highlightsContainer = document.getElementById('highlights-container');
    flashcardsEmpty = document.getElementById('flashcards-empty');
    highlightsEmpty = document.getElementById('highlights-empty');
    flashcardsLoading = document.getElementById('flashcards-loading');
    highlightsLoading = document.getElementById('highlights-loading');

    // Pagination
    pagination = document.getElementById('pagination');
    pageInfo = document.getElementById('page-info');
    prevPageBtn = document.getElementById('prev-page');
    nextPageBtn = document.getElementById('next-page');

    // Modals
    editModal = document.getElementById('edit-modal');
    deleteModal = document.getElementById('delete-modal');
    detailModal = document.getElementById('detail-modal');
}

/**
 * Set up all event listeners
 */
function setupEventListeners() {
    // Tab navigation
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // Search
    searchInput.addEventListener('input', handleSearch);
    clearSearchBtn.addEventListener('click', clearSearch);

    // Sort dropdown
    sortToggle.addEventListener('click', () => toggleDropdown(sortToggle.parentElement));
    document.querySelectorAll('#sort-dropdown .dropdown-item').forEach(item => {
        item.addEventListener('click', () => handleSort(item.dataset.sort));
    });

    // Tag filter dropdown
    tagFilterToggle.addEventListener('click', () => toggleDropdown(tagFilterToggle.parentElement));

    // Source filter dropdown
    sourceFilterToggle.addEventListener('click', () => toggleDropdown(sourceFilterToggle.parentElement));

    // View mode toggle
    document.querySelectorAll('.view-button').forEach(btn => {
        btn.addEventListener('click', () => switchViewMode(btn.dataset.view));
    });

    // Export
    exportButton.addEventListener('click', handleExport);

    // Settings
    settingsButton.addEventListener('click', openSettings);

    // Pagination
    prevPageBtn.addEventListener('click', () => changePage(-1));
    nextPageBtn.addEventListener('click', () => changePage(1));

    // Modals
    setupModalListeners();

    // Close dropdowns when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.custom-dropdown')) {
            document.querySelectorAll('.custom-dropdown').forEach(dropdown => {
                dropdown.classList.remove('open');
            });
        }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyboardShortcuts);
}

/**
 * Set up modal event listeners
 */
function setupModalListeners() {
    // Edit modal
    const editModalCloseBtn = editModal.querySelector('.modal-close');
    const editModalCancelBtn = editModal.querySelector('.modal-cancel');
    const editModalSaveBtn = document.getElementById('save-edit');

    editModalCloseBtn.addEventListener('click', closeEditModal);
    editModalCancelBtn.addEventListener('click', closeEditModal);
    editModalSaveBtn.addEventListener('click', saveEdit);

    editModal.querySelector('.modal-backdrop').addEventListener('click', closeEditModal);

    // Delete modal
    const deleteModalCloseBtn = deleteModal.querySelector('.modal-close');
    const deleteModalCancelBtn = deleteModal.querySelector('.modal-cancel');
    const deleteModalConfirmBtn = document.getElementById('confirm-delete');

    deleteModalCloseBtn.addEventListener('click', closeDeleteModal);
    deleteModalCancelBtn.addEventListener('click', closeDeleteModal);
    deleteModalConfirmBtn.addEventListener('click', confirmDelete);

    deleteModal.querySelector('.modal-backdrop').addEventListener('click', closeDeleteModal);

    // Detail modal
    const detailModalCloseBtn = detailModal.querySelector('.modal-close');
    const detailModalCancelBtn = detailModal.querySelector('.modal-cancel');
    const detailEditBtn = document.getElementById('detail-edit');
    const detailDeleteBtn = document.getElementById('detail-delete');

    detailModalCloseBtn.addEventListener('click', closeDetailModal);
    detailModalCancelBtn.addEventListener('click', closeDetailModal);
    detailEditBtn.addEventListener('click', () => {
        closeDetailModal();
        if (currentDetailId && currentDetailType) {
            openEditModal(currentDetailId, currentDetailType);
        }
    });
    detailDeleteBtn.addEventListener('click', () => {
        closeDetailModal();
        if (currentDetailId && currentDetailType) {
            openDeleteModal(currentDetailId, currentDetailType);
        }
    });

    detailModal.querySelector('.modal-backdrop').addEventListener('click', closeDetailModal);
}

/**
 * Handle keyboard shortcuts
 */
function handleKeyboardShortcuts(e) {
    // Escape to close modals
    if (e.key === 'Escape') {
        closeEditModal();
        closeDeleteModal();
        closeDetailModal();
    }

    // Ctrl/Cmd + F to focus search
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        searchInput.focus();
    }

    // Arrow keys for pagination
    if (e.key === 'ArrowLeft' && !prevPageBtn.disabled) {
        changePage(-1);
    }
    if (e.key === 'ArrowRight' && !nextPageBtn.disabled) {
        changePage(1);
    }
}

// ============================================
// Data Loading
// ============================================

/**
 * Load all data
 */
async function loadData() {
    console.log('Loading data...');

    // Show loading skeletons
    showLoadingSkeleton();

    // Load flashcards
    allFlashcards = await Storage.getFlashcards();
    filteredFlashcards = [...allFlashcards];

    // Load highlights
    allHighlights = await Storage.getHighlights();
    filteredHighlights = [...allHighlights];

    // Load template settings
    const settings = await Storage.getSettings();
    currentTemplate = settings.useDefaultTemplate
        ? Storage.getDefaultTemplate()
        : (settings.customTemplate || Storage.getDefaultTemplate());

    // Update UI
    updateCounts();
    updateTagFilter();
    updateSourceFilter();
    applyFiltersAndSort();
    renderCurrentTab();

    console.log(`Loaded ${allFlashcards.length} flashcards and ${allHighlights.length} highlights`);
}

/**
 * Load user preferences from storage
 */
async function loadPreferences() {
    try {
        const prefs = await chrome.storage.local.get(['studyViewMode']);
        if (prefs.studyViewMode) {
            currentViewMode = prefs.studyViewMode;
            updateViewModeButtons();
        }
    } catch (error) {
        console.error('Error loading preferences:', error);
    }
}

/**
 * Save user preferences to storage
 */
async function savePreferences() {
    try {
        await chrome.storage.local.set({ studyViewMode: currentViewMode });
    } catch (error) {
        console.error('Error saving preferences:', error);
    }
}

// ============================================
// Tab Management
// ============================================

/**
 * Switch between tabs
 */
function switchTab(tab, skipRender = false) {
    currentTab = tab;
    currentPage = 1;

    // Update tab buttons
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });

    // Update content visibility
    flashcardsContent.classList.toggle('active', tab === 'flashcards');
    highlightsContent.classList.toggle('active', tab === 'highlights');

    // Show/hide filters (only for highlights)
    tagFilterContainer.style.display = tab === 'highlights' ? 'block' : 'none';
    sourceFilterContainer.style.display = tab === 'highlights' ? 'block' : 'none';

    // Render content (unless skipped during initialization)
    if (!skipRender) {
        renderCurrentTab();
    }
}

// ============================================
// View Mode Management
// ============================================

/**
 * Switch view mode
 */
function switchViewMode(mode) {
    currentViewMode = mode;
    currentPage = 1;

    // Update buttons
    updateViewModeButtons();

    // Save preference
    savePreferences();

    // Re-render
    renderCurrentTab();
}

/**
 * Update view mode button states
 */
function updateViewModeButtons() {
    document.querySelectorAll('.view-button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === currentViewMode);
    });
}

// ============================================
// Search, Filter, and Sort
// ============================================

/**
 * Handle search input
 */
function handleSearch() {
    clearTimeout(searchDebounceTimer);

    const query = searchInput.value.trim();

    // Show/hide clear button
    clearSearchBtn.style.display = query ? 'block' : 'none';

    searchDebounceTimer = setTimeout(() => {
        searchQuery = query;
        currentPage = 1;
        applyFiltersAndSort();
        renderCurrentTab();
    }, 300);
}

/**
 * Clear search
 */
function clearSearch() {
    searchInput.value = '';
    searchQuery = '';
    clearSearchBtn.style.display = 'none';
    currentPage = 1;
    applyFiltersAndSort();
    renderCurrentTab();
}

/**
 * Handle sort selection
 */
function handleSort(sort) {
    currentSort = sort;
    currentPage = 1;

    // Update dropdown
    document.querySelectorAll('#sort-dropdown .dropdown-item').forEach(item => {
        item.classList.toggle('active', item.dataset.sort === sort);
    });

    // Update button text
    document.getElementById('selected-sort').textContent =
        document.querySelector(`#sort-dropdown [data-sort="${sort}"]`).textContent;

    // Close dropdown
    sortToggle.parentElement.classList.remove('open');

    // Re-filter and render
    applyFiltersAndSort();
    renderCurrentTab();
}

/**
 * Handle tag filter selection
 */
function handleTagFilter(tag) {
    selectedTag = tag;
    currentPage = 1;

    // Update dropdown
    document.querySelectorAll('#tag-dropdown .dropdown-item').forEach(item => {
        item.classList.toggle('active', item.dataset.tag === tag);
    });

    // Update button text
    document.getElementById('selected-tag').textContent = tag || 'All Tags';

    // Close dropdown
    tagFilterToggle.parentElement.classList.remove('open');

    // Re-filter and render
    applyFiltersAndSort();
    renderCurrentTab();
}

/**
 * Update tag filter dropdown with available tags
 */
function updateTagFilter() {
    // Collect all unique tags
    const tags = new Set();
    allHighlights.forEach(h => {
        if (h.tags) {
            h.tags.forEach(tag => tags.add(tag));
        }
    });

    // Build dropdown
    const sortedTags = Array.from(tags).sort();
    tagDropdown.innerHTML = '<div class="dropdown-item active" data-tag="">All Tags</div>';

    sortedTags.forEach(tag => {
        const item = document.createElement('div');
        item.className = 'dropdown-item';
        item.dataset.tag = tag;
        item.textContent = tag;
        item.addEventListener('click', () => handleTagFilter(tag));
        tagDropdown.appendChild(item);
    });
}

/**
 * Handle source filter selection
 */
function handleSourceFilter(source) {
    selectedSource = source;
    currentPage = 1;

    // Update dropdown
    document.querySelectorAll('#source-dropdown .dropdown-item').forEach(item => {
        item.classList.toggle('active', item.dataset.source === source);
    });

    // Update button text
    const displayText = source ? (source.length > 25 ? source.substring(0, 25) + '...' : source) : 'All Sources';
    document.getElementById('selected-source').textContent = displayText;

    // Close dropdown
    sourceFilterToggle.parentElement.classList.remove('open');

    // Re-filter and render
    applyFiltersAndSort();
    renderCurrentTab();
}

/**
 * Update source filter dropdown with available sources
 */
function updateSourceFilter() {
    // Collect all unique source URLs (without query params)
    const sources = new Set();
    allHighlights.forEach(h => {
        if (h.sourceUrl) {
            const cleanUrl = getCleanUrl(h.sourceUrl);
            sources.add(cleanUrl);
        }
    });

    // Build dropdown
    const sortedSources = Array.from(sources).sort();
    sourceDropdown.innerHTML = '<div class="dropdown-item active" data-source="">All Sources</div>';

    sortedSources.forEach(source => {
        const item = document.createElement('div');
        item.className = 'dropdown-item';
        item.dataset.source = source;
        // Truncate long URLs for display
        const displayText = source.length > 40 ? source.substring(0, 40) + '...' : source;
        item.textContent = displayText;
        item.title = source; // Full URL on hover
        item.addEventListener('click', () => handleSourceFilter(source));
        sourceDropdown.appendChild(item);
    });
}

/**
 * Get clean URL without query parameters
 */
function getCleanUrl(url) {
    try {
        const urlObj = new URL(url);
        return urlObj.origin + urlObj.pathname;
    } catch {
        return url;
    }
}

/**
 * Apply all filters and sorting
 */
function applyFiltersAndSort() {
    if (currentTab === 'flashcards') {
        filterAndSortFlashcards();
    } else {
        filterAndSortHighlights();
    }
}

/**
 * Filter and sort flashcards
 */
function filterAndSortFlashcards() {
    filteredFlashcards = [...allFlashcards];

    // Apply search
    if (searchQuery) {
        const lowerQuery = searchQuery.toLowerCase();
        filteredFlashcards = filteredFlashcards.filter(f => {
            return f.word.toLowerCase().includes(lowerQuery) ||
                   f.definition.toLowerCase().includes(lowerQuery) ||
                   (f.sourceUrl && f.sourceUrl.toLowerCase().includes(lowerQuery)) ||
                   (f.sourceTitle && f.sourceTitle.toLowerCase().includes(lowerQuery));
        });
    }

    // Apply sort
    switch (currentSort) {
        case 'newest':
            filteredFlashcards.sort((a, b) => b.createdAt - a.createdAt);
            break;
        case 'oldest':
            filteredFlashcards.sort((a, b) => a.createdAt - b.createdAt);
            break;
        case 'a-z':
            filteredFlashcards.sort((a, b) => a.word.localeCompare(b.word));
            break;
        case 'z-a':
            filteredFlashcards.sort((a, b) => b.word.localeCompare(a.word));
            break;
    }
}

/**
 * Filter and sort highlights
 */
function filterAndSortHighlights() {
    filteredHighlights = [...allHighlights];

    // Apply tag filter
    if (selectedTag) {
        filteredHighlights = filteredHighlights.filter(h =>
            h.tags && h.tags.includes(selectedTag)
        );
    }

    // Apply source filter
    if (selectedSource) {
        filteredHighlights = filteredHighlights.filter(h =>
            h.sourceUrl && getCleanUrl(h.sourceUrl) === selectedSource
        );
    }

    // Apply search
    if (searchQuery) {
        const lowerQuery = searchQuery.toLowerCase();
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
    switch (currentSort) {
        case 'newest':
            filteredHighlights.sort((a, b) => b.createdAt - a.createdAt);
            break;
        case 'oldest':
            filteredHighlights.sort((a, b) => a.createdAt - b.createdAt);
            break;
        case 'a-z':
            filteredHighlights.sort((a, b) => a.text.localeCompare(b.text));
            break;
        case 'z-a':
            filteredHighlights.sort((a, b) => b.text.localeCompare(a.text));
            break;
    }
}

// ============================================
// Rendering
// ============================================

/**
 * Render current tab content
 */
function renderCurrentTab() {
    if (currentTab === 'flashcards') {
        renderFlashcards();
    } else {
        renderHighlights();
    }
    updatePagination();
}

/**
 * Render flashcards
 */
function renderFlashcards() {
    flashcardsLoading.style.display = 'none';

    if (filteredFlashcards.length === 0) {
        flashcardsEmpty.style.display = 'flex';
        flashcardsContainer.style.display = 'none';
        pagination.style.display = 'none';
        return;
    }

    flashcardsEmpty.style.display = 'none';
    flashcardsContainer.style.display = 'grid';

    // Update view mode class
    flashcardsContainer.className = `items-container view-${currentViewMode}`;

    // Paginate
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const end = Math.min(start + ITEMS_PER_PAGE, filteredFlashcards.length);
    const pageItems = filteredFlashcards.slice(start, end);

    // Render items
    flashcardsContainer.innerHTML = '';
    pageItems.forEach(flashcard => {
        const element = createFlashcardElement(flashcard);
        flashcardsContainer.appendChild(element);
    });
}

/**
 * Render highlights
 */
function renderHighlights() {
    highlightsLoading.style.display = 'none';

    if (filteredHighlights.length === 0) {
        highlightsEmpty.style.display = 'flex';
        highlightsContainer.style.display = 'none';
        pagination.style.display = 'none';
        return;
    }

    highlightsEmpty.style.display = 'none';
    highlightsContainer.style.display = 'grid';

    // Update view mode class
    highlightsContainer.className = `items-container view-${currentViewMode}`;

    // Paginate
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const end = Math.min(start + ITEMS_PER_PAGE, filteredHighlights.length);
    const pageItems = filteredHighlights.slice(start, end);

    // Render items
    highlightsContainer.innerHTML = '';
    pageItems.forEach(highlight => {
        const element = createHighlightElement(highlight);
        highlightsContainer.appendChild(element);
    });
}

/**
 * Create flashcard element
 */
function createFlashcardElement(flashcard) {
    const card = document.createElement('div');
    card.className = 'flashcard-item';
    card.dataset.id = flashcard.id;

    // Format definition
    const formattedDefinition = flashcard.data
        ? formatStructuredData(flashcard.data)
        : applyMarkdownFormatting(flashcard.definition);

    // Format date and source
    const formattedDate = formatDate(new Date(flashcard.createdAt));
    const domain = extractDomain(flashcard.sourceUrl);

    card.innerHTML = `
        <div class="flashcard-header">
            <div class="flashcard-word">${escapeHtml(flashcard.word)}</div>
            <div class="flashcard-actions">
                <button class="action-button edit-btn" title="Edit">
                    <img src="icons/pencil.svg" alt="Edit">
                </button>
                <button class="action-button delete-btn delete" title="Delete">
                    <img src="icons/trash-2.svg" alt="Delete">
                </button>
            </div>
        </div>
        <div class="flashcard-definition">${formattedDefinition}</div>
        <div class="flashcard-meta">
            <div class="flashcard-source">
                <span>Source: </span>
                <a href="${escapeHtml(flashcard.sourceUrl)}" target="_blank" title="${escapeHtml(flashcard.sourceTitle || flashcard.sourceUrl)}">
                    ${escapeHtml(domain)}
                </a>
            </div>
            <div class="flashcard-date">${formattedDate}</div>
        </div>
    `;

    // Event listeners
    card.addEventListener('click', () => {
        openDetailModal(flashcard.id, 'flashcard');
    });

    // Prevent source link from opening detail modal
    const sourceLink = card.querySelector('.flashcard-source a');
    if (sourceLink) {
        sourceLink.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }

    card.querySelector('.edit-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        openEditModal(flashcard.id, 'flashcard');
    });

    card.querySelector('.delete-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        openDeleteModal(flashcard.id, 'flashcard');
    });

    return card;
}

/**
 * Create highlight element
 */
function createHighlightElement(highlight) {
    const card = document.createElement('div');
    card.className = 'highlight-item';
    card.dataset.id = highlight.id;

    // Format date and source
    const formattedDate = formatDate(new Date(highlight.createdAt));
    const domain = extractDomain(highlight.sourceUrl);

    // Description
    const descriptionHtml = highlight.description
        ? `<div class="highlight-description">${applyMarkdownFormatting(highlight.description)}</div>`
        : '';

    // Tags
    const tagsHtml = highlight.tags && highlight.tags.length > 0
        ? `<div class="highlight-tags">
            ${highlight.tags.map(tag => `<span class="tag" data-tag="${escapeHtml(tag)}">${escapeHtml(tag)}</span>`).join('')}
          </div>`
        : '';

    // Meta badges
    const badges = [];
    if (highlight.promptName) {
        badges.push(`<span class="meta-badge">${escapeHtml(highlight.promptName)}</span>`);
    }
    if (highlight.modelId) {
        const modelName = highlight.modelId.split('/').pop();
        badges.push(`<span class="meta-badge">${escapeHtml(modelName)}</span>`);
    }

    const badgesHtml = badges.length > 0
        ? `<div class="highlight-badges">${badges.join('')}</div>`
        : '';

    card.innerHTML = `
        <div class="highlight-header">
            <div class="highlight-text">${escapeHtml(highlight.text)}</div>
            <div class="flashcard-actions">
                <button class="action-button delete-btn delete" title="Delete">
                    <img src="icons/trash-2.svg" alt="Delete">
                </button>
            </div>
        </div>
        ${descriptionHtml}
        ${tagsHtml}
        <div class="highlight-meta">
            <div class="flashcard-source">
                <span>Source: </span>
                <a href="${escapeHtml(highlight.sourceUrl)}" target="_blank" title="${escapeHtml(highlight.sourceTitle || highlight.sourceUrl)}">
                    ${escapeHtml(domain)}
                </a>
            </div>
            <div class="flashcard-date">${formattedDate}</div>
        </div>
        ${badgesHtml}
    `;

    // Event listeners
    card.addEventListener('click', () => {
        openDetailModal(highlight.id, 'highlight');
    });

    // Event listeners for tags
    card.querySelectorAll('.tag').forEach(tag => {
        tag.addEventListener('click', (e) => {
            e.stopPropagation();
            if (currentTab === 'highlights') {
                handleTagFilter(tag.dataset.tag);
            }
        });
    });

    // Prevent source link from opening detail modal
    const sourceLink = card.querySelector('.flashcard-source a');
    if (sourceLink) {
        sourceLink.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }

    card.querySelector('.delete-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        openDeleteModal(highlight.id, 'highlight');
    });

    return card;
}

/**
 * Show loading skeleton
 */
function showLoadingSkeleton() {
    const createSkeleton = () => {
        const div = document.createElement('div');
        div.className = 'skeleton-item';
        div.innerHTML = `
            <div class="skeleton-line title"></div>
            <div class="skeleton-line long"></div>
            <div class="skeleton-line medium"></div>
            <div class="skeleton-line short"></div>
        `;
        return div;
    };

    // Flashcards skeleton
    flashcardsLoading.innerHTML = '';
    for (let i = 0; i < 3; i++) {
        flashcardsLoading.appendChild(createSkeleton());
    }
    flashcardsLoading.style.display = 'grid';

    // Highlights skeleton
    highlightsLoading.innerHTML = '';
    for (let i = 0; i < 3; i++) {
        highlightsLoading.appendChild(createSkeleton());
    }
    highlightsLoading.style.display = 'grid';
}

// ============================================
// Pagination
// ============================================

/**
 * Update pagination controls
 */
function updatePagination() {
    const items = currentTab === 'flashcards' ? filteredFlashcards : filteredHighlights;
    const totalPages = Math.ceil(items.length / ITEMS_PER_PAGE);

    if (totalPages <= 1) {
        pagination.style.display = 'none';
        return;
    }

    pagination.style.display = 'flex';
    pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
    prevPageBtn.disabled = currentPage === 1;
    nextPageBtn.disabled = currentPage === totalPages;
}

/**
 * Change page
 */
function changePage(delta) {
    const items = currentTab === 'flashcards' ? filteredFlashcards : filteredHighlights;
    const totalPages = Math.ceil(items.length / ITEMS_PER_PAGE);

    const newPage = currentPage + delta;
    if (newPage >= 1 && newPage <= totalPages) {
        currentPage = newPage;
        renderCurrentTab();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

// ============================================
// Modals
// ============================================

/**
 * Open edit modal
 */
function openEditModal(id, type) {
    currentEditingId = id;
    currentEditingType = type;

    if (type === 'flashcard') {
        const flashcard = allFlashcards.find(f => f.id === id);
        if (!flashcard) return;

        document.getElementById('edit-modal-title').textContent = 'Edit Flashcard';
        document.getElementById('edit-word').value = flashcard.word;
        document.getElementById('edit-definition').value = flashcard.definition;
    }

    editModal.classList.add('active');
}

/**
 * Close edit modal
 */
function closeEditModal() {
    editModal.classList.remove('active');
    currentEditingId = null;
    currentEditingType = null;
}

/**
 * Save edit
 */
async function saveEdit() {
    if (!currentEditingId || currentEditingType !== 'flashcard') return;

    const word = document.getElementById('edit-word').value.trim();
    const definition = document.getElementById('edit-definition').value.trim();

    if (!word || !definition) {
        alert('Word and definition are required');
        return;
    }

    try {
        const flashcard = allFlashcards.find(f => f.id === currentEditingId);
        if (flashcard) {
            flashcard.word = word;
            flashcard.definition = definition;
            flashcard.updatedAt = Date.now();

            await Storage.updateFlashcard(flashcard);

            closeEditModal();
            await loadData();
        }
    } catch (error) {
        console.error('Error saving edit:', error);
        alert('Failed to save changes');
    }
}

/**
 * Open delete modal
 */
function openDeleteModal(id, type) {
    currentDeletingId = id;
    currentDeletingType = type;

    const message = type === 'flashcard'
        ? 'Are you sure you want to delete this flashcard?'
        : 'Are you sure you want to delete this highlight?';

    document.getElementById('delete-message').textContent = message;
    deleteModal.classList.add('active');
}

/**
 * Close delete modal
 */
function closeDeleteModal() {
    deleteModal.classList.remove('active');
    currentDeletingId = null;
    currentDeletingType = null;
}

/**
 * Confirm delete
 */
async function confirmDelete() {
    if (!currentDeletingId || !currentDeletingType) return;

    try {
        if (currentDeletingType === 'flashcard') {
            await Storage.deleteFlashcard(currentDeletingId);
        } else if (currentDeletingType === 'highlight') {
            await Storage.deleteHighlight(currentDeletingId);
        }

        closeDeleteModal();
        await loadData();
    } catch (error) {
        console.error('Error deleting item:', error);
        alert('Failed to delete item');
    }
}

/**
 * Open detail modal
 */
function openDetailModal(id, type) {
    currentDetailId = id;
    currentDetailType = type;

    const modalBody = document.getElementById('detail-modal-body');
    const modalTitle = document.getElementById('detail-modal-title');
    const detailEditBtn = document.getElementById('detail-edit');

    if (type === 'flashcard') {
        const flashcard = allFlashcards.find(f => f.id === id);
        if (!flashcard) return;

        modalTitle.textContent = 'Flashcard Details';
        detailEditBtn.style.display = 'inline-flex';

        // Format definition
        const formattedDefinition = flashcard.data
            ? formatStructuredData(flashcard.data)
            : applyMarkdownFormatting(flashcard.definition);

        // Format date
        const formattedDate = new Date(flashcard.createdAt).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        modalBody.innerHTML = `
            <div class="detail-word">${escapeHtml(flashcard.word)}</div>

            <div class="detail-section">
                <h3>Definition</h3>
                <div class="detail-section-content">
                    ${formattedDefinition}
                </div>
            </div>

            <div class="detail-meta">
                <div class="detail-meta-item">
                    <div class="detail-meta-label">Source</div>
                    <div class="detail-meta-value">
                        <a href="${escapeHtml(flashcard.sourceUrl)}" target="_blank">
                            ${escapeHtml(flashcard.sourceTitle || flashcard.sourceUrl)}
                        </a>
                    </div>
                </div>
                <div class="detail-meta-item">
                    <div class="detail-meta-label">Created</div>
                    <div class="detail-meta-value">${formattedDate}</div>
                </div>
            </div>
        `;
    } else if (type === 'highlight') {
        const highlight = allHighlights.find(h => h.id === id);
        if (!highlight) return;

        modalTitle.textContent = 'Highlight Details';
        detailEditBtn.style.display = 'none';

        // Format description
        const descriptionHtml = highlight.description
            ? `<div class="detail-section">
                <h3>Description</h3>
                <div class="detail-section-content">
                    ${applyMarkdownFormatting(highlight.description)}
                </div>
              </div>`
            : '';

        // Format tags
        const tagsHtml = highlight.tags && highlight.tags.length > 0
            ? `<div class="detail-section">
                <h3>Tags</h3>
                <div class="detail-tags">
                    ${highlight.tags.map(tag => `<span class="detail-tag">${escapeHtml(tag)}</span>`).join('')}
                </div>
              </div>`
            : '';

        // Format date
        const formattedDate = new Date(highlight.createdAt).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        // Meta items
        const metaItems = [
            {
                label: 'Source',
                value: `<a href="${escapeHtml(highlight.sourceUrl)}" target="_blank">${escapeHtml(highlight.sourceTitle || highlight.sourceUrl)}</a>`
            },
            {
                label: 'Created',
                value: formattedDate
            }
        ];

        if (highlight.promptName) {
            metaItems.push({
                label: 'Prompt',
                value: escapeHtml(highlight.promptName)
            });
        }

        if (highlight.modelId) {
            const modelName = highlight.modelId.split('/').pop();
            metaItems.push({
                label: 'Model',
                value: escapeHtml(modelName)
            });
        }

        const metaHtml = `
            <div class="detail-meta">
                ${metaItems.map(item => `
                    <div class="detail-meta-item">
                        <div class="detail-meta-label">${item.label}</div>
                        <div class="detail-meta-value">${item.value}</div>
                    </div>
                `).join('')}
            </div>
        `;

        modalBody.innerHTML = `
            <div class="detail-text">${escapeHtml(highlight.text)}</div>

            ${descriptionHtml}
            ${tagsHtml}
            ${metaHtml}
        `;
    }

    detailModal.classList.add('active');
}

/**
 * Close detail modal
 */
function closeDetailModal() {
    detailModal.classList.remove('active');
    currentDetailId = null;
    currentDetailType = null;
}

// ============================================
// Export
// ============================================

/**
 * Handle export
 */
async function handleExport() {
    if (currentTab === 'flashcards') {
        exportFlashcardsToAnki();
    } else {
        exportHighlightsToCSV();
    }
}

/**
 * Export flashcards to Anki format
 */
function exportFlashcardsToAnki() {
    if (filteredFlashcards.length === 0) {
        alert('No flashcards to export');
        return;
    }

    let csv = 'Front,Back\n';

    filteredFlashcards.forEach(flashcard => {
        const front = flashcard.word.replace(/"/g, '""');
        const back = flashcard.definition.replace(/"/g, '""');
        csv += `"${front}","${back}"\n`;
    });

    downloadFile(csv, 'flashcards.csv', 'text/csv');
}

/**
 * Export highlights to CSV
 */
function exportHighlightsToCSV() {
    if (filteredHighlights.length === 0) {
        alert('No highlights to export');
        return;
    }

    let csv = 'Text,Description,Tags,Source,Date\n';

    filteredHighlights.forEach(highlight => {
        const text = (highlight.text || '').replace(/"/g, '""');
        const description = (highlight.description || '').replace(/"/g, '""');
        const tags = (highlight.tags || []).join(', ').replace(/"/g, '""');
        const source = (highlight.sourceTitle || highlight.sourceUrl || '').replace(/"/g, '""');
        const date = new Date(highlight.createdAt).toLocaleDateString();

        csv += `"${text}","${description}","${tags}","${source}","${date}"\n`;
    });

    downloadFile(csv, 'highlights.csv', 'text/csv');
}

/**
 * Download file
 */
function downloadFile(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

// ============================================
// Utility Functions
// ============================================

/**
 * Toggle dropdown
 */
function toggleDropdown(dropdown) {
    const isOpen = dropdown.classList.contains('open');

    // Close all dropdowns
    document.querySelectorAll('.custom-dropdown').forEach(d => {
        d.classList.remove('open');
    });

    // Toggle current dropdown
    if (!isOpen) {
        dropdown.classList.add('open');
    }
}

/**
 * Update counts
 */
function updateCounts() {
    flashcardsCountBadge.textContent = allFlashcards.length;
    highlightsCountBadge.textContent = allHighlights.length;
}

/**
 * Open settings
 */
function openSettings() {
    chrome.runtime.openOptionsPage();
}

/**
 * Format structured data from schema
 */
function formatStructuredData(data, template = null) {
    if (!data || typeof data !== 'object') {
        return escapeHtml(String(data));
    }

    const activeTemplate = template || currentTemplate || Storage.getDefaultTemplate();
    const rendered = Storage.renderTemplate(activeTemplate, data);

    if (rendered && rendered.trim()) {
        return applyMarkdownFormatting(rendered);
    }

    // Fallback
    let html = '';
    for (const [key, value] of Object.entries(data)) {
        if (!value) continue;
        const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()).trim();
        html += `<div><strong>${escapeHtml(label)}:</strong> ${escapeHtml(String(value))}</div>`;
    }
    return html || escapeHtml('No data available');
}

/**
 * Apply markdown formatting
 */
function applyMarkdownFormatting(text) {
    if (!text) return '';

    let formatted = escapeHtml(text);

    // Headings
    formatted = formatted.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    formatted = formatted.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    formatted = formatted.replace(/^# (.+)$/gm, '<h1>$1</h1>');

    // Horizontal rules
    formatted = formatted.replace(/^---$/gm, '<hr>');
    formatted = formatted.replace(/^\*\*\*$/gm, '<hr>');

    // Code blocks
    formatted = formatted.replace(/```([^`]+)```/g, '<pre><code>$1</code></pre>');
    formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Bold
    formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // Italic
    formatted = formatted.replace(/(?<!\w)\*(.+?)\*(?!\w)/g, '<em>$1</em>');

    // Lists
    formatted = formatted.replace(/^- (.+)$/gm, '<li>$1</li>');
    formatted = formatted.replace(/(<li>.*?<\/li>(?:\n|$))+/g, match => '<ul>' + match + '</ul>');

    // Links
    formatted = formatted.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');

    // Line breaks
    formatted = formatted.replace(/\n\n+/g, '</p><p>');
    formatted = formatted.replace(/\n/g, '<br>');

    // Wrap in paragraph
    if (!formatted.match(/^<(h[123]|ul|ol|pre|hr)/)) {
        formatted = `<p>${formatted}</p>`;
    }

    // Clean up
    formatted = formatted.replace(/<p><\/p>/g, '');

    return formatted;
}

/**
 * Format date
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

    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
}

/**
 * Extract domain from URL
 */
function extractDomain(url) {
    try {
        const urlObj = new URL(url);
        return urlObj.hostname.replace('www.', '');
    } catch {
        return 'Unknown';
    }
}

/**
 * Escape HTML
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================
// Initialize on DOM ready
// ============================================
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
