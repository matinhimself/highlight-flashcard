/**
 * Lexis Contextual Toolbar
 * Shows a floating toolbar above selected text with actions for creating flashcards,
 * highlights, descriptions, and AI-powered previews.
 */

class LexisToolbar {
  constructor() {
    this.toolbar = null;
    this.selectedText = '';
    this.selectionRange = null;
    this.isExpanded = false;
    this.previewData = null;
    this.describeMenuOpen = false;
    this.describePrompts = [];
    this.iconCache = {};

    this.init();
    this.loadDescribePrompts();
    this.loadIcons();
  }

  init() {
    // Listen for text selection
    document.addEventListener('mouseup', this.handleSelection.bind(this));
    document.addEventListener('selectionchange', this.handleSelectionChange.bind(this));

    // Hide toolbar when clicking outside
    document.addEventListener('mousedown', (e) => {
      if (this.toolbar && !this.toolbar.contains(e.target)) {
        this.hideToolbar();
      }
    });

    // Hide toolbar on scroll
    document.addEventListener('scroll', () => {
      if (this.toolbar && !this.isExpanded) {
        this.hideToolbar();
      }
    }, true);
  }

  async loadDescribePrompts() {
    try {
      const result = await chrome.storage.local.get('describePrompts');
      const prompts = result.describePrompts || [];
      this.describePrompts = prompts.filter(p => p.enabled);
    } catch (error) {
      console.error('Error loading describe prompts:', error);
      this.describePrompts = [];
    }
  }

  async loadIcons() {
    const iconNames = ['sparkles', 'book-marked', 'pencil', 'eye', 'x', 'book-open'];

    for (const name of iconNames) {
      try {
        const url = chrome.runtime.getURL(`ui/icons/${name}.svg`);
        const response = await fetch(url);
        let svgContent = await response.text();

        // Replace currentColor with themed green (except for 'x' icon)
        if (name !== 'x') {
          svgContent = svgContent.replace(/stroke="currentColor"/g, 'stroke="#10b981"');
        } else {
          svgContent = svgContent.replace(/stroke="currentColor"/g, 'stroke="#94a3b8"');
        }

        // Extract just the SVG content (remove xml declaration if present)
        const svgMatch = svgContent.match(/<svg[\s\S]*<\/svg>/);
        this.iconCache[name] = svgMatch ? svgMatch[0] : svgContent;
      } catch (error) {
        console.error(`Error loading icon ${name}:`, error);
        this.iconCache[name] = '';
      }
    }
  }

  handleSelectionChange() {
    // Debounce to avoid too many updates
    clearTimeout(this.selectionTimeout);
    this.selectionTimeout = setTimeout(() => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) {
        if (this.toolbar && !this.isExpanded) {
          this.hideToolbar();
        }
      }
    }, 100);
  }

  handleSelection(e) {
    const selection = window.getSelection();
    const text = selection.toString().trim();

    // Don't show toolbar if:
    // - No text selected
    // - Selection is within the toolbar itself
    // - Text is too short (less than 2 characters)
    if (!text || text.length < 2 || (this.toolbar && this.toolbar.contains(e.target))) {
      return;
    }

    this.selectedText = text;
    this.selectionRange = selection.getRangeAt(0);

    // Show toolbar after a small delay to avoid flashing
    setTimeout(() => {
      if (window.getSelection().toString().trim() === text) {
        this.showToolbar();
      }
    }, 150);
  }

  createToolbar() {
    // Remove existing toolbar if any
    if (this.toolbar) {
      this.toolbar.remove();
    }

    const toolbar = document.createElement('div');
    toolbar.className = 'lexis-toolbar';
    toolbar.innerHTML = `
      <button class="lexis-toolbar-close" aria-label="Close">
        ${this.getIcon('x')}
      </button>
      <div class="lexis-toolbar-buttons">
        <button class="lexis-toolbar-btn" data-action="flashcard" data-tooltip="Create Flashcard">
          ${this.getIcon('sparkles')}
        </button>
        <button class="lexis-toolbar-btn" data-action="highlight" data-tooltip="Save Highlight">
          ${this.getIcon('book-marked')}
        </button>
        <button class="lexis-toolbar-btn" data-action="describe" data-tooltip="Describe">
          ${this.getIcon('pencil')}
        </button>
        <div class="lexis-toolbar-divider"></div>
        <button class="lexis-toolbar-btn" data-action="preview" data-tooltip="AI Preview">
          ${this.getIcon('eye')}
        </button>
      </div>
      <div class="lexis-toolbar-describe">
        <div class="lexis-describe-content"></div>
      </div>
      <div class="lexis-toolbar-preview">
        <div class="lexis-preview-content"></div>
      </div>
    `;

    // Attach event listeners
    const buttons = toolbar.querySelectorAll('.lexis-toolbar-btn');
    buttons.forEach(btn => {
      btn.addEventListener('click', this.handleAction.bind(this));
    });

    const closeBtn = toolbar.querySelector('.lexis-toolbar-close');
    closeBtn.addEventListener('click', () => this.hideToolbar());

    this.toolbar = toolbar;
    document.body.appendChild(toolbar);

    return toolbar;
  }

  async showDescribeOptions(button) {
    // If already expanded with describe, collapse
    if (this.isExpanded && this.describeMenuOpen) {
      this.collapseDescribe();
      return;
    }

    // Close preview if it's open
    if (this.isExpanded && !this.describeMenuOpen) {
      this.collapsePreview();
    }

    button.classList.add('loading');

    try {
      // Reload describe prompts to ensure we have the latest
      await this.loadDescribePrompts();

      // Show loading state
      this.expandToolbarForDescribe();
      this.showDescribeLoadingState();

      // Small delay for smooth animation
      await new Promise(resolve => setTimeout(resolve, 200));

      // Render describe options
      await this.renderDescribeOptions();
      this.describeMenuOpen = true;
    } catch (error) {
      console.error('Error showing describe options:', error);
      this.showNotification('Failed to load describe options', 'error');
      this.collapseDescribe();
    } finally {
      button.classList.remove('loading');
    }
  }

  expandToolbarForDescribe() {
    if (!this.toolbar) return;

    this.toolbar.classList.add('expanded', 'animating');
    this.isExpanded = true;

    const animation = this.toolbar.animate([
      { maxWidth: '200px' },
      { maxWidth: '400px' }
    ], {
      duration: 400,
      easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      fill: 'forwards'
    });

    animation.onfinish = () => {
      this.toolbar.classList.remove('animating');
      this.positionToolbar();
    };
  }

  showDescribeLoadingState() {
    const describeEl = this.toolbar.querySelector('.lexis-toolbar-describe');
    const contentEl = describeEl.querySelector('.lexis-describe-content');

    contentEl.innerHTML = `
      <div class="lexis-describe-loading">
        <div class="lexis-describe-loading-icon">
          ${this.getIcon('sparkles')}
        </div>
        <span class="lexis-describe-loading-text">Loading models...</span>
      </div>
    `;

    describeEl.classList.add('visible');
  }

  async renderDescribeOptions() {
    const describeEl = this.toolbar.querySelector('.lexis-toolbar-describe');
    const contentEl = describeEl.querySelector('.lexis-describe-content');

    // Fade out loading state
    await this.fadeOut(contentEl.firstElementChild);

    // Build describe options HTML
    let optionsHTML = '';

    if (this.describePrompts.length === 0) {
      optionsHTML = `
        <div class="lexis-describe-header">
          <h3>Describe Models</h3>
        </div>
        <div class="lexis-describe-empty">
          <p>No describe models available</p>
          <p class="lexis-describe-empty-hint">Add describe models in the extension settings</p>
        </div>
      `;
    } else {
      const promptButtons = this.describePrompts.map(prompt => `
        <button class="lexis-describe-option" data-prompt-id="${prompt.id}">
          <div class="lexis-describe-option-icon">${this.getIcon('pencil')}</div>
          <div class="lexis-describe-option-text">
            <div class="lexis-describe-option-name">${this.escapeHtml(prompt.name)}</div>
          </div>
        </button>
      `).join('');

      optionsHTML = `
        <div class="lexis-describe-header">
          <h3>Choose Describe Model</h3>
        </div>
        <div class="lexis-describe-options">
          ${promptButtons}
        </div>
      `;
    }

    contentEl.innerHTML = optionsHTML;

    // Attach event listeners to describe option buttons
    const optionButtons = contentEl.querySelectorAll('.lexis-describe-option');
    optionButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const promptId = btn.dataset.promptId;
        this.handleDescribePrompt(promptId);
      });
    });

    // Fade in describe options
    await this.fadeIn(contentEl.firstElementChild);
  }

  collapseDescribe() {
    if (!this.toolbar) return;

    const describeEl = this.toolbar.querySelector('.lexis-toolbar-describe');
    describeEl.classList.remove('visible');
    this.describeMenuOpen = false;

    setTimeout(() => {
      this.toolbar.classList.remove('expanded');
      this.isExpanded = false;
      this.positionToolbar();
    }, 300);
  }

  async handleDescribePrompt(promptId) {
    const describeEl = this.toolbar.querySelector('.lexis-toolbar-describe');
    const contentEl = describeEl.querySelector('.lexis-describe-content');

    // Show minimal custom loading state
    contentEl.innerHTML = `
      <div class="lexis-describe-loading">
        <div class="lexis-describe-loading-icon">
          ${this.getIcon('sparkles')}
        </div>
        <span class="lexis-describe-loading-text">Generating description...</span>
      </div>
    `;

    try {
      // Generate XPath for the selection
      const xpath = this.getXPathForSelection();
      const selectionRect = this.selectionRange.getBoundingClientRect();

      const response = await chrome.runtime.sendMessage({
        action: 'describeWithPrompt',
        text: this.selectedText,
        sourceUrl: window.location.href,
        sourceTitle: document.title,
        promptId: promptId,
        xpath: xpath,
        position: {
          x: selectionRect.left + window.scrollX,
          y: selectionRect.top + window.scrollY
        }
      });

      if (response.success) {
        this.showNotification('Description saved!', 'success');

        // Inject visual indicator at the highlight position
        this.injectDescriptionIndicator(xpath, response.highlightId, selectionRect);

        this.hideToolbar();
      } else {
        throw new Error(response.error || 'Failed to describe text');
      }
    } catch (error) {
      console.error('Error describing text:', error);
      this.showNotification('Failed to describe text', 'error');
      // Go back to describe options on error
      await this.renderDescribeOptions();
    }
  }

  /**
   * Generate XPath for the current selection
   * @returns {string} XPath expression
   */
  getXPathForSelection() {
    if (!this.selectionRange) return '';

    try {
      const container = this.selectionRange.commonAncestorContainer;
      const node = container.nodeType === Node.TEXT_NODE ? container.parentNode : container;

      // Generate XPath to the node
      const xpath = this.getXPath(node);
      return xpath;
    } catch (error) {
      console.error('Error generating XPath:', error);
      return '';
    }
  }

  /**
   * Generate XPath for a DOM node
   * @param {Node} node - DOM node
   * @returns {string} XPath expression
   */
  getXPath(node) {
    if (node.id) {
      return `//*[@id="${node.id}"]`;
    }

    const parts = [];
    while (node && node.nodeType === Node.ELEMENT_NODE) {
      let index = 0;
      let sibling = node.previousSibling;

      while (sibling) {
        if (sibling.nodeType === Node.ELEMENT_NODE && sibling.nodeName === node.nodeName) {
          index++;
        }
        sibling = sibling.previousSibling;
      }

      const tagName = node.nodeName.toLowerCase();
      const pathIndex = index > 0 ? `[${index + 1}]` : '';
      parts.unshift(tagName + pathIndex);

      node = node.parentNode;
    }

    return parts.length ? '/' + parts.join('/') : '';
  }

  /**
   * Inject a visual indicator at the highlight position
   * @param {string} xpath - XPath of the highlight
   * @param {string} highlightId - ID of the saved highlight
   * @param {DOMRect} rect - Position rectangle
   */
  injectDescriptionIndicator(xpath, highlightId, rect) {
    // Remove any existing indicator for this highlight
    const existingIndicator = document.querySelector(`[data-highlight-id="${highlightId}"]`);
    if (existingIndicator) {
      existingIndicator.remove();
    }

    // Create indicator element
    const indicator = document.createElement('div');
    indicator.className = 'lexis-description-indicator';
    indicator.dataset.highlightId = highlightId;
    indicator.dataset.xpath = xpath;
    indicator.innerHTML = `
      <div class="lexis-description-indicator-icon">
        ${this.getIcon('book-open')}
      </div>
    `;

    // Position the indicator
    indicator.style.left = `${rect.left + window.scrollX}px`;
    indicator.style.top = `${rect.top + window.scrollY - 30}px`;

    // Add click handler to show description
    indicator.addEventListener('click', async (e) => {
      e.stopPropagation();
      await this.showDescriptionPopover(highlightId, indicator);
    });

    document.body.appendChild(indicator);

    // Animate in
    requestAnimationFrame(() => {
      indicator.classList.add('visible');
    });

    // Auto-hide after 10 seconds
    setTimeout(() => {
      if (indicator && indicator.parentNode) {
        indicator.classList.remove('visible');
        setTimeout(() => indicator.remove(), 300);
      }
    }, 10000);
  }

  /**
   * Show description popover for a highlight
   * @param {string} highlightId - ID of the highlight
   * @param {HTMLElement} anchorEl - Element to anchor popover to
   */
  async showDescriptionPopover(highlightId, anchorEl) {
    try {
      // Get the highlight from storage
      const response = await chrome.runtime.sendMessage({
        action: 'getHighlight',
        highlightId: highlightId
      });

      if (!response.success || !response.highlight) {
        throw new Error('Highlight not found');
      }

      const highlight = response.highlight;

      // Remove any existing popover
      const existingPopover = document.querySelector('.lexis-description-popover');
      if (existingPopover) {
        existingPopover.remove();
      }

      // Create popover
      const popover = document.createElement('div');
      popover.className = 'lexis-description-popover';

      const description = highlight.description || 'No description available';
      const tags = highlight.tags ? highlight.tags.map(tag =>
        `<span class="lexis-description-tag">${this.escapeHtml(tag)}</span>`
      ).join('') : '';

      popover.innerHTML = `
        <div class="lexis-description-popover-header">
          <div class="lexis-description-popover-title">
            ${this.getIcon('sparkles')}
            <span>${highlight.promptName || 'Description'}</span>
          </div>
          <button class="lexis-description-popover-close">
            ${this.getIcon('x')}
          </button>
        </div>
        <div class="lexis-description-popover-content">
          <div class="lexis-description-popover-text">${this.escapeHtml(highlight.text)}</div>
          <div class="lexis-description-popover-description">${this.escapeHtml(description)}</div>
          ${tags ? `<div class="lexis-description-popover-tags">${tags}</div>` : ''}
        </div>
      `;

      // Position popover near the indicator
      const rect = anchorEl.getBoundingClientRect();
      popover.style.left = `${rect.left + window.scrollX}px`;
      popover.style.top = `${rect.bottom + window.scrollY + 10}px`;

      document.body.appendChild(popover);

      // Add close handler
      const closeBtn = popover.querySelector('.lexis-description-popover-close');
      closeBtn.addEventListener('click', () => {
        popover.classList.remove('visible');
        setTimeout(() => popover.remove(), 300);
      });

      // Close on outside click
      const closeOnOutsideClick = (e) => {
        if (!popover.contains(e.target) && e.target !== anchorEl) {
          popover.classList.remove('visible');
          setTimeout(() => popover.remove(), 300);
          document.removeEventListener('mousedown', closeOnOutsideClick);
        }
      };

      setTimeout(() => {
        document.addEventListener('mousedown', closeOnOutsideClick);
      }, 100);

      // Animate in
      requestAnimationFrame(() => {
        popover.classList.add('visible');
      });

    } catch (error) {
      console.error('Error showing description:', error);
      this.showNotification('Failed to load description', 'error');
    }
  }

  showToolbar() {
    if (!this.selectionRange) return;

    const toolbar = this.toolbar || this.createToolbar();

    // Position toolbar above selection
    this.positionToolbar();

    // Show with animation
    requestAnimationFrame(() => {
      toolbar.classList.add('visible');
    });
  }

  positionToolbar() {
    if (!this.selectionRange || !this.toolbar) return;

    const rect = this.selectionRange.getBoundingClientRect();
    const toolbarRect = this.toolbar.getBoundingClientRect();

    // Calculate position (centered above selection)
    let left = rect.left + (rect.width / 2) - (toolbarRect.width / 2);
    let top = rect.top - toolbarRect.height - 10;

    // Adjust if toolbar would go off-screen
    const padding = 10;
    if (left < padding) {
      left = padding;
    } else if (left + toolbarRect.width > window.innerWidth - padding) {
      left = window.innerWidth - toolbarRect.width - padding;
    }

    // If toolbar would be above viewport, show below selection
    if (top < padding) {
      top = rect.bottom + 10;
    }

    // Add scroll offsets
    this.toolbar.style.left = `${left + window.scrollX}px`;
    this.toolbar.style.top = `${top + window.scrollY}px`;
  }

  hideToolbar() {
    if (!this.toolbar) return;

    this.toolbar.classList.remove('visible', 'expanded');
    this.isExpanded = false;
    this.describeMenuOpen = false;

    setTimeout(() => {
      if (this.toolbar && !this.toolbar.classList.contains('visible')) {
        this.toolbar.remove();
        this.toolbar = null;
        this.previewData = null;
      }
    }, 200);
  }

  async handleAction(e) {
    const action = e.currentTarget.dataset.action;
    const button = e.currentTarget;

    switch (action) {
      case 'flashcard':
        await this.createFlashcard(button);
        break;
      case 'highlight':
        await this.saveHighlight(button);
        break;
      case 'describe':
        await this.showDescribeOptions(button);
        break;
      case 'preview':
        await this.showPreview(button);
        break;
    }
  }

  async createFlashcard(button) {
    button.classList.add('loading');

    try {
      // Send message to background script to create flashcard
      const response = await chrome.runtime.sendMessage({
        action: 'createFlashcard',
        text: this.selectedText,
        sourceUrl: window.location.href
      });

      if (response.success) {
        this.showNotification('Flashcard created successfully!', 'success');
        this.hideToolbar();
      } else {
        throw new Error(response.error || 'Failed to create flashcard');
      }
    } catch (error) {
      console.error('Error creating flashcard:', error);
      this.showNotification('Failed to create flashcard', 'error');
    } finally {
      button.classList.remove('loading');
    }
  }

  async saveHighlight(button) {
    button.classList.add('loading');

    try {
      // Send message to background script to save highlight
      const response = await chrome.runtime.sendMessage({
        action: 'saveHighlight',
        text: this.selectedText,
        sourceUrl: window.location.href,
        sourceTitle: document.title
      });

      if (response.success) {
        this.showNotification('Highlight saved!', 'success');
        this.hideToolbar();
      } else {
        throw new Error(response.error || 'Failed to save highlight');
      }
    } catch (error) {
      console.error('Error saving highlight:', error);
      this.showNotification('Failed to save highlight', 'error');
    } finally {
      button.classList.remove('loading');
    }
  }


  async showPreview(button) {
    // If already expanded, collapse
    if (this.isExpanded) {
      this.collapsePreview();
      return;
    }

    button.classList.add('loading');

    try {
      // Show loading state
      this.expandToolbar();
      this.showLoadingState();

      // Request preview from background script
      const response = await chrome.runtime.sendMessage({
        action: 'generatePreview',
        text: this.selectedText
      });

      if (response.success) {
        this.previewData = response.data;
        await this.renderPreview(response.preview);
      } else {
        throw new Error(response.error || 'Failed to generate preview');
      }
    } catch (error) {
      console.error('Error generating preview:', error);
      this.showNotification('Failed to generate preview', 'error');
      this.collapsePreview();
    } finally {
      button.classList.remove('loading');
    }
  }

  expandToolbar() {
    if (!this.toolbar) return;

    // Add 'expanded' class first to set flex-direction: column
    this.toolbar.classList.add('expanded', 'animating');
    this.isExpanded = true;

    // Use Web Animations API for smooth expansion
    const animation = this.toolbar.animate([
      { maxWidth: '200px' },
      { maxWidth: '400px' }
    ], {
      duration: 400,
      easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      fill: 'forwards'
    });

    animation.onfinish = () => {
      this.toolbar.classList.remove('animating');
      this.positionToolbar(); // Reposition after expansion
    };
  }

  collapsePreview() {
    if (!this.toolbar) return;

    const previewEl = this.toolbar.querySelector('.lexis-toolbar-preview');
    previewEl.classList.remove('visible');

    setTimeout(() => {
      this.toolbar.classList.remove('expanded');
      this.isExpanded = false;
      this.positionToolbar();
    }, 300);
  }

  showLoadingState() {
    const previewEl = this.toolbar.querySelector('.lexis-toolbar-preview');
    const contentEl = previewEl.querySelector('.lexis-preview-content');

    contentEl.innerHTML = `
      <div class="lexis-toolbar-loading">
        <div class="lexis-toolbar-spinner"></div>
        <span>Generating preview...</span>
      </div>
    `;

    previewEl.classList.add('visible');
  }

  async renderPreview(previewHtml) {
    const previewEl = this.toolbar.querySelector('.lexis-toolbar-preview');
    const contentEl = previewEl.querySelector('.lexis-preview-content');

    // Fade out loading state
    await this.fadeOut(contentEl.firstElementChild);

    // Set preview content with action buttons
    contentEl.innerHTML = `
      <div class="lexis-preview-flashcard">
        ${previewHtml}
      </div>
      <div class="lexis-preview-actions">
        <button class="lexis-preview-btn lexis-preview-btn-primary" data-action="save-word">
          Save as Flashcard
        </button>
        <button class="lexis-preview-btn lexis-preview-btn-secondary" data-action="close-preview">
          Close
        </button>
      </div>
    `;

    // Attach event listeners to action buttons
    const saveBtn = contentEl.querySelector('[data-action="save-word"]');
    const closeBtn = contentEl.querySelector('[data-action="close-preview"]');

    saveBtn.addEventListener('click', () => this.savePreviewAsFlashcard());
    closeBtn.addEventListener('click', () => this.collapsePreview());

    // Fade in preview content
    await this.fadeIn(contentEl.firstElementChild);
  }

  async savePreviewAsFlashcard() {
    const saveBtn = this.toolbar.querySelector('[data-action="save-word"]');

    // Disable button and show loading state
    saveBtn.disabled = true;
    const originalText = saveBtn.textContent;
    saveBtn.textContent = 'Saving...';

    try {
      // Send message to background script to create flashcard
      const response = await chrome.runtime.sendMessage({
        action: 'createFlashcard',
        text: this.selectedText,
        sourceUrl: window.location.href
      });

      if (response.success) {
        this.showNotification('Flashcard saved successfully!', 'success');
        // Close the preview after saving
        setTimeout(() => {
          this.hideToolbar();
        }, 500);
      } else {
        throw new Error(response.error || 'Failed to save flashcard');
      }
    } catch (error) {
      console.error('Error saving flashcard:', error);
      this.showNotification('Failed to save flashcard', 'error');
      // Re-enable button
      saveBtn.disabled = false;
      saveBtn.textContent = originalText;
    }
  }

  fadeOut(element) {
    return new Promise(resolve => {
      if (!element) {
        resolve();
        return;
      }

      const animation = element.animate([
        { opacity: 1 },
        { opacity: 0 }
      ], {
        duration: 200,
        easing: 'ease-out'
      });

      animation.onfinish = resolve;
    });
  }

  fadeIn(element) {
    return new Promise(resolve => {
      if (!element) {
        resolve();
        return;
      }

      element.style.opacity = '0';

      const animation = element.animate([
        { opacity: 0 },
        { opacity: 1 }
      ], {
        duration: 300,
        easing: 'ease-in'
      });

      animation.onfinish = () => {
        element.style.opacity = '1';
        resolve();
      };
    });
  }

  showNotification(message, type = 'info') {
    // Create a temporary notification element
    const notification = document.createElement('div');
    notification.className = `lexis-notification lexis-notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: ${type === 'success' ? '#10b981' : '#ef4444'};
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
      z-index: 2147483647;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 14px;
      animation: slideIn 0.3s ease-out;
    `;

    document.body.appendChild(notification);

    // Remove after 3 seconds
    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease-out';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  getIcon(name) {
    return this.iconCache[name] || '';
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize toolbar
const lexisToolbar = new LexisToolbar();

// Add keyframe animations
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(100%);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);
