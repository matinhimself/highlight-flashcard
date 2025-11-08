# Highlight Flashcard Extension - Specification

## Overview
A browser extension that allows users to create flashcards from highlighted text using OpenRouter AI to generate definitions and explanations.

## Version
1.0.0

## Target Browsers
- Chrome/Chromium (Manifest V3)
- Firefox (Manifest V3 compatible)

## Core Features

### 1. Context Menu Integration
- **Feature**: Right-click context menu option "Create Flashcard"
- **Trigger**: Available when text is selected on any webpage
- **Action**: Captures selected text and initiates flashcard creation

### 2. Local Storage Database
- **Storage**: Browser's local storage API
- **Data Structure**: Flashcard pairs (word/phrase + AI-generated explanation)
- **Schema**: See `specs/storage-schema.spec.md`

### 3. Settings Page
- **API Configuration**: OpenRouter API key input
- **Model Selection**: Dropdown with available OpenRouter models
- **Custom Prompt**: Textarea for customizing AI prompt
- **Default Prompt**: English dictionary-style definitions
- **Persistence**: All settings saved to browser storage

### 4. OpenRouter Integration
- **API Endpoint**: https://openrouter.ai/api/v1/chat/completions
- **Request Format**: OpenAI-compatible chat completion
- **Error Handling**: Network errors, API errors, rate limits
- **Response Processing**: Extract definition from AI response

### 5. Flashcard Management
- **Viewer**: Display all saved flashcards
- **Search**: Filter flashcards by word/phrase
- **Delete**: Remove individual flashcards
- **Export**: Future feature - export to CSV/Anki format

## Component Architecture

### Core Components
1. **manifest.json** - Extension configuration
2. **background.js** - Service worker for context menu and API calls
3. **content.js** - Content script for text selection
4. **settings.html/js** - Settings page UI and logic
5. **flashcards.html/js** - Flashcard viewer UI and logic
6. **storage.js** - Storage abstraction layer
7. **api.js** - OpenRouter API client

### Data Flow
1. User selects text → Content script detects selection
2. User right-clicks → Background worker shows context menu
3. User clicks "Create Flashcard" → Background worker captures selection
4. Background worker calls OpenRouter API with selected text + prompt
5. API response processed and saved to local storage
6. User can view flashcards in flashcard viewer page

## Default Prompt Template
```
You are a helpful English dictionary assistant. Provide a clear, concise definition for the following word or phrase. Include:
1. Part of speech
2. Definition
3. Example sentence
4. Etymology (if relevant)

Word/Phrase: {selected_text}

Format your response in a clear, easy-to-understand manner suitable for a flashcard.
```

## Security Considerations
- API keys stored in browser's local storage (not synced)
- API requests made from background worker only
- No external script injection
- Content Security Policy compliance

## Future Enhancements
- Spaced repetition algorithm
- Export to Anki/CSV
- Multiple language support
- Offline mode with cached definitions
- Flashcard categories/tags
- Study mode with quiz functionality

## File Structure
```
highlight-flashcard/
├── manifest.json
├── background/
│   ├── background.js
│   └── api.js
├── content/
│   └── content.js
├── ui/
│   ├── settings.html
│   ├── settings.js
│   ├── settings.css
│   ├── flashcards.html
│   ├── flashcards.js
│   └── flashcards.css
├── lib/
│   └── storage.js
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── specs/
│   ├── context-menu.spec.md
│   ├── storage-schema.spec.md
│   ├── api-integration.spec.md
│   ├── settings-page.spec.md
│   └── flashcard-viewer.spec.md
└── README.md
```

## Testing Requirements
- Manual testing on Chrome and Firefox
- Test API error handling
- Test storage limits
- Test with various text selections
- Test settings persistence
