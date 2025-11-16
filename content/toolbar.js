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

    this.init();
    this.loadDescribePrompts();
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
          <div class="lexis-describe-menu">
            ${this.renderDescribeMenu()}
          </div>
        </button>
        <div class="lexis-toolbar-divider"></div>
        <button class="lexis-toolbar-btn" data-action="preview" data-tooltip="AI Preview">
          ${this.getIcon('eye')}
        </button>
      </div>
      <div class="lexis-toolbar-preview">
        <div class="lexis-preview-content"></div>
      </div>
    `;

    // Attach event listeners
    const buttons = toolbar.querySelectorAll('.lexis-toolbar-btn:not([data-action="describe"])');
    buttons.forEach(btn => {
      btn.addEventListener('click', this.handleAction.bind(this));
    });

    // Describe button has special handling for menu toggle
    const describeBtn = toolbar.querySelector('[data-action="describe"]');
    describeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleDescribeMenu();
    });

    // Attach listeners to describe menu items
    const menuItems = toolbar.querySelectorAll('.lexis-describe-menu-item');
    menuItems.forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const promptId = item.dataset.promptId;
        this.handleDescribePrompt(promptId);
      });
    });

    const closeBtn = toolbar.querySelector('.lexis-toolbar-close');
    closeBtn.addEventListener('click', () => this.hideToolbar());

    this.toolbar = toolbar;
    document.body.appendChild(toolbar);

    return toolbar;
  }

  renderDescribeMenu() {
    if (this.describePrompts.length === 0) {
      return '<div class="lexis-describe-menu-empty">No describe prompts available</div>';
    }

    return this.describePrompts.map(prompt => `
      <button class="lexis-describe-menu-item" data-prompt-id="${prompt.id}">
        ${this.escapeHtml(prompt.name)}
      </button>
    `).join('');
  }

  toggleDescribeMenu() {
    const menu = this.toolbar.querySelector('.lexis-describe-menu');
    if (!menu) return;

    this.describeMenuOpen = !this.describeMenuOpen;

    if (this.describeMenuOpen) {
      menu.classList.add('visible');
    } else {
      menu.classList.remove('visible');
    }
  }

  closeDescribeMenu() {
    const menu = this.toolbar?.querySelector('.lexis-describe-menu');
    if (menu) {
      menu.classList.remove('visible');
      this.describeMenuOpen = false;
    }
  }

  async handleDescribePrompt(promptId) {
    this.closeDescribeMenu();

    const describeBtn = this.toolbar.querySelector('[data-action="describe"]');
    describeBtn.classList.add('loading');

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'describeWithPrompt',
        text: this.selectedText,
        sourceUrl: window.location.href,
        sourceTitle: document.title,
        promptId: promptId
      });

      if (response.success) {
        this.showNotification('Description saved!', 'success');
        this.hideToolbar();
      } else {
        throw new Error(response.error || 'Failed to describe text');
      }
    } catch (error) {
      console.error('Error describing text:', error);
      this.showNotification('Failed to describe text', 'error');
    } finally {
      describeBtn.classList.remove('loading');
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

    this.closeDescribeMenu();
    this.toolbar.classList.remove('visible', 'expanded');
    this.isExpanded = false;

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
        await this.describeText(button);
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

  async describeText(button) {
    button.classList.add('loading');

    try {
      // Send message to background script to describe text
      const response = await chrome.runtime.sendMessage({
        action: 'describeText',
        text: this.selectedText,
        sourceUrl: window.location.href,
        sourceTitle: document.title
      });

      if (response.success) {
        this.showNotification('Description saved!', 'success');
        this.hideToolbar();
      } else {
        throw new Error(response.error || 'Failed to describe text');
      }
    } catch (error) {
      console.error('Error describing text:', error);
      this.showNotification('Failed to describe text', 'error');
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

    this.toolbar.classList.add('animating');

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
      this.toolbar.classList.add('expanded');
      this.toolbar.classList.remove('animating');
      this.isExpanded = true;
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
    const icons = {
      'sparkles': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v18m9-9H3m15.364-6.364L5.636 18.364m12.728 0L5.636 5.636"/></svg>',
      'book-marked': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><path d="M12 2v10l2-2 2 2V2"/></svg>',
      'pencil': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>',
      'eye': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>',
      'x': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>'
    };

    return icons[name] || '';
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
