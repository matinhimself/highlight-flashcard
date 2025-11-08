# Context Menu Specification

## Version
1.0.0

## Feature Description
Add a context menu item that appears when text is selected, allowing users to create flashcards from the highlighted text.

## Context Menu Configuration

### Menu Item Properties
- **ID**: `create-flashcard`
- **Title**: "Create Flashcard"
- **Contexts**: `["selection"]`
- **Document URL Patterns**: `["<all_urls>"]`

### Visual Appearance
- Icon: Extension icon (16x16)
- Position: In main context menu (not in submenu)

## Behavior Specification

### When Menu Item is Clicked
1. Capture the selected text (`info.selectionText`)
2. Capture the page URL (`tab.url`)
3. Show loading notification (optional badge/icon change)
4. Call OpenRouter API with selected text
5. Save flashcard to storage
6. Show success/error notification

### User Notifications
- **Success**: "Flashcard created for '{word}'"
- **API Error**: "Failed to create flashcard: {error message}"
- **No API Key**: "Please configure OpenRouter API key in settings"
- **Network Error**: "Network error. Please try again."

## Permissions Required
- `contextMenus`: To create context menu items
- `storage`: To access settings and save flashcards
- `notifications`: To show user feedback
- `activeTab`: To capture page URL

## Edge Cases

### Empty Selection
- Should not show menu item (handled by `contexts: ["selection"]`)

### Very Long Selection (>500 characters)
- Truncate to first 500 characters for API call
- Show warning: "Selection truncated to 500 characters"

### Multiple Rapid Clicks
- Debounce: Ignore clicks within 2 seconds of previous click
- Show message: "Please wait, creating flashcard..."

### API Key Not Configured
- Check for API key before making request
- Show settings page if not configured

## Implementation Requirements

### Background Service Worker
```javascript
chrome.contextMenus.create({
  id: "create-flashcard",
  title: "Create Flashcard",
  contexts: ["selection"]
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  // Handle flashcard creation
});
```

### Error Recovery
- Retry logic: 3 attempts with exponential backoff
- Cache failed requests for manual retry
- Provide "Retry Last Flashcard" option in popup

## Testing Checklist
- [ ] Menu item appears when text is selected
- [ ] Menu item does NOT appear when no text is selected
- [ ] Clicking menu creates flashcard successfully
- [ ] Error notification shows when API fails
- [ ] Settings prompt shows when no API key configured
- [ ] Works on all websites (including HTTPS and HTTP)
- [ ] Works with special characters and unicode
- [ ] Works with multi-line selections
