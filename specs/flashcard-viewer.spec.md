# Flashcard Viewer Specification

## Version
1.0.0

## Overview
A dedicated page to view, search, study, and manage all saved flashcards.

## Page Access
- **URL**: `chrome-extension://{extension-id}/ui/flashcards.html`
- **Access Method**:
  - Click extension icon → Main page
  - Extension popup default page

## UI Components

### 1. Header Section

#### Title
- **Text**: "My Flashcards"
- **Badge**: Show count "({total} cards)"

#### Actions Bar
- Search input
- Sort dropdown
- Settings button (link to settings page)

### 2. Search and Filter Section

#### Search Input
- **Placeholder**: "Search flashcards..."
- **Search Fields**: word, definition, source URL
- **Behavior**: Real-time filtering (debounced 300ms)
- **Clear Button**: X icon to clear search

#### Sort Dropdown
- **Options**:
  - Newest first (default)
  - Oldest first
  - Alphabetical (A-Z)
  - Alphabetical (Z-A)
  - By source URL

#### Filter Chips (Future)
- By date range
- By model used
- By source domain

### 3. Flashcard List/Grid

#### View Modes
- **List View** (default): Vertical list with full details
- **Grid View**: Card-style grid layout
- **Toggle**: Button to switch between views

#### Flashcard Card Component (List View)

```
+------------------------------------------------+
| ephemeral                           [Edit] [×] |
|------------------------------------------------|
| **Adjective**                                  |
| Lasting for a very short time; transitory.     |
|                                                |
| **Example**: The beauty of cherry blossoms is  |
| ephemeral, lasting only a few weeks.           |
|                                                |
| Source: example.com/article                    |
| Created: Nov 8, 2025 | Model: Claude 3.5       |
+------------------------------------------------+
```

#### Flashcard Properties Display
- **Word/Phrase**: Large, bold text
- **Definition**: Rendered markdown
- **Source URL**: Clickable link (truncated domain)
- **Metadata**: Created date, model used (small text)
- **Actions**: Edit, Delete buttons

### 4. Empty State

When no flashcards exist:
```
+------------------------------------------+
|              📚                          |
|      No flashcards yet                   |
|                                          |
|  Highlight text on any webpage and       |
|  select "Create Flashcard" to get        |
|  started.                                |
|                                          |
|  [Go to Settings]                        |
+------------------------------------------+
```

### 5. Study Mode (Future)

#### Study Button
- **Location**: Header
- **Behavior**: Enter study mode with flashcard quiz
- **Features**:
  - Show word, user guesses, reveal definition
  - Mark as "Know" or "Don't Know"
  - Spaced repetition algorithm

### 6. Bulk Actions

#### Selection Mode
- **Trigger**: Checkbox on each card or "Select" button
- **Actions Bar**:
  - Select All
  - Delete Selected
  - Export Selected

#### Export Options
- CSV format
- JSON format
- Anki-compatible format

### 7. Action Modals

#### Delete Confirmation
```
Delete Flashcard?

Are you sure you want to delete the flashcard
for "ephemeral"? This cannot be undone.

[Cancel]  [Delete]
```

#### Edit Modal
```
Edit Flashcard

Word: [ephemeral____________]

Definition:
+----------------------------------------+
|                                        |
| [Markdown-enabled textarea]            |
|                                        |
+----------------------------------------+

Source URL: [https://example.com/article]

[Cancel]  [Save Changes]
```

## Layout Structure

```
+--------------------------------------------------+
| My Flashcards (42)              [⚙️ Settings]     |
+--------------------------------------------------+
| [🔍 Search...]  [Sort: Newest ▼]  [☰ List View] |
+--------------------------------------------------+
|                                                  |
| +----------------------------------------------+ |
| | word1                           [Edit] [×]   | |
| |----------------------------------------------| |
| | Definition text here...                      | |
| | Source: example.com | Nov 8, 2025            | |
| +----------------------------------------------+ |
|                                                  |
| +----------------------------------------------+ |
| | word2                           [Edit] [×]   | |
| |----------------------------------------------| |
| | Definition text here...                      | |
| | Source: example.com | Nov 7, 2025            | |
| +----------------------------------------------+ |
|                                                  |
| [Load More]                                      |
+--------------------------------------------------+
```

## Behavior Specifications

### On Page Load
1. Load all flashcards from storage
2. Sort by newest first (default)
3. Render first 20 cards
4. Show loading indicator if needed

### On Search Input
1. Debounce 300ms
2. Filter flashcards by search term
3. Search in word, definition, source URL
4. Update count badge
5. Show "No results" if empty

### On Sort Change
1. Re-sort flashcard array
2. Re-render list
3. Maintain scroll position if possible

### On Delete Click
1. Show confirmation modal
2. If confirmed:
   - Remove from storage
   - Remove from DOM
   - Show success message
   - Update count badge

### On Edit Click
1. Load flashcard data into modal
2. Show edit modal
3. On save:
   - Validate inputs
   - Update storage
   - Update card in DOM
   - Show success message

### Infinite Scroll / Pagination
- Load 20 cards initially
- Load 20 more on scroll to bottom or "Load More" click
- Show loading indicator while loading

## Data Rendering

### Markdown Support
- Render definition as markdown
- Support: bold, italic, lists, code blocks
- Use a lightweight markdown library (e.g., marked.js)

### Date Formatting
- Relative dates: "2 hours ago", "3 days ago"
- Absolute for old: "Nov 8, 2025"
- Use consistent format throughout

### URL Display
- Show domain only: "example.com"
- Clickable (opens in new tab)
- Tooltip shows full URL on hover

## Performance Considerations

### Large Data Sets
- Virtual scrolling for 1000+ cards
- Lazy load images (if any)
- Debounce search input
- Efficient filtering algorithms

### Storage Access
- Load all cards once on page load
- Cache in memory
- Only re-fetch on known changes

## Keyboard Shortcuts
- `Ctrl/Cmd + F`: Focus search
- `Ctrl/Cmd + S`: Open settings
- `Delete`: Delete selected card (with confirmation)
- `E`: Edit selected card
- `Esc`: Close modal/clear search

## Accessibility
- Semantic HTML structure
- ARIA labels for icons
- Keyboard navigation for all actions
- Focus management in modals
- Screen reader announcements for actions

## Responsive Design
- Minimum width: 320px (mobile)
- Desktop: 2-column layout for grid view
- Tablet: 1-2 columns based on width
- Mobile: Single column, stacked layout

## Error Handling

### Storage Errors
- Show error message: "Failed to load flashcards"
- Retry button
- Log error to console

### Corrupted Data
- Skip invalid flashcards
- Show warning: "Some flashcards could not be loaded"
- Provide option to clear corrupted data

## Testing Checklist
- [ ] Load flashcards successfully
- [ ] Search filters correctly
- [ ] Sort options work
- [ ] Delete removes flashcard
- [ ] Edit saves changes
- [ ] Empty state displays correctly
- [ ] Pagination/infinite scroll works
- [ ] Markdown renders correctly
- [ ] Responsive on different screen sizes
- [ ] Keyboard shortcuts work
- [ ] Error handling works
- [ ] Performance good with 100+ cards
