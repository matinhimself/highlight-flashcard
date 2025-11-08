# Storage Schema Specification

## Version
1.0.0

## Storage API
Browser's `chrome.storage.local` API (compatible with Firefox)

## Data Structures

### 1. Settings Object
**Storage Key**: `settings`

```typescript
interface Settings {
  apiKey: string;              // OpenRouter API key
  selectedModel: string;        // Selected model ID (e.g., "anthropic/claude-3-sonnet")
  useCustomModel: boolean;      // Whether to use custom model ID
  customModelId: string;        // Custom model ID entered by user
  customPrompt: string;         // User's custom prompt template
  useDefaultPrompt: boolean;    // Whether to use default or custom prompt
}
```

**Default Values**:
```json
{
  "apiKey": "",
  "selectedModel": "anthropic/claude-3.5-sonnet",
  "useCustomModel": false,
  "customModelId": "",
  "customPrompt": "",
  "useDefaultPrompt": true
}
```

### 2. Flashcards Array
**Storage Key**: `flashcards`

```typescript
interface Flashcard {
  id: string;                   // Unique identifier (UUID or timestamp-based)
  word: string;                 // Selected word/phrase
  definition: string;           // AI-generated definition
  sourceUrl: string;            // URL where word was highlighted
  createdAt: number;            // Timestamp (milliseconds since epoch)
  model: string;                // Model used to generate definition
  prompt: string;               // Prompt used (for reference)
}
```

**Example**:
```json
{
  "id": "1699564821234-abc123",
  "word": "ephemeral",
  "definition": "**Adjective**\n\nLasting for a very short time; transitory.\n\n**Example**: The beauty of cherry blossoms is ephemeral, lasting only a few weeks.\n\n**Etymology**: From Greek ephēmeros 'lasting only a day'.",
  "sourceUrl": "https://example.com/article",
  "createdAt": 1699564821234,
  "model": "anthropic/claude-3.5-sonnet",
  "prompt": "You are a helpful English dictionary..."
}
```

## Storage Operations

### Read Operations
- `getSettings()`: Retrieve current settings
- `getFlashcards()`: Retrieve all flashcards
- `getFlashcard(id)`: Retrieve single flashcard by ID
- `searchFlashcards(query)`: Search flashcards by word

### Write Operations
- `saveSettings(settings)`: Update settings
- `addFlashcard(flashcard)`: Add new flashcard
- `updateFlashcard(id, updates)`: Update existing flashcard
- `deleteFlashcard(id)`: Remove flashcard
- `clearAllFlashcards()`: Remove all flashcards

## Storage Limits
- Chrome local storage limit: ~5MB
- Estimated capacity: ~5000-10000 flashcards (depending on definition length)
- Warning threshold: 4MB (alert user to export/clean up)

## Migration Strategy
- Version field in settings for future schema changes
- Migration functions for backward compatibility

## Error Handling
- Handle storage quota exceeded
- Handle corrupted data (fallback to defaults)
- Validate data structure on read operations
