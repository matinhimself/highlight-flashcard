# Highlight Flashcard Extension

A browser extension that helps you create AI-powered flashcards from highlighted text on any webpage. Uses OpenRouter API to generate smart, dictionary-style definitions.

## Features

- **Context Menu Integration**: Right-click any highlighted text to create a flashcard
- **AI-Powered Definitions**: Uses OpenRouter AI models (Claude, GPT, Llama, etc.) to generate clear, educational definitions
- **Local Storage**: All flashcards stored locally in your browser
- **Customizable Prompts**: Choose between default dictionary-style prompts or create your own
- **Model Selection**: Support for multiple AI models with different capabilities and costs
- **Search & Sort**: Easily find and organize your flashcards
- **Edit & Delete**: Full management of your flashcard collection

## Installation

### Chrome/Edge

1. Download or clone this repository
2. Open Chrome/Edge and navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top-right corner)
4. Click "Load unpacked"
5. Select the `highlight-flashcard` folder
6. The extension icon should appear in your toolbar

### Firefox

1. Download or clone this repository
2. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`
3. Click "Load Temporary Add-on"
4. Select the `manifest.json` file from the `highlight-flashcard` folder
5. The extension will be loaded temporarily (will persist until Firefox restart)

**Note**: For permanent installation in Firefox, the extension needs to be signed. See [Firefox Add-on Distribution](https://extensionworkshop.com/documentation/publish/).

## Setup

### 1. Get an OpenRouter API Key

1. Visit [OpenRouter](https://openrouter.ai/)
2. Sign up for an account
3. Navigate to [API Keys](https://openrouter.ai/keys)
4. Create a new API key (starts with `sk-or-`)
5. Copy the API key

### 2. Configure the Extension

1. Click the extension icon in your toolbar
2. Click the "Settings" button (⚙️) or right-click the extension icon and select "Options"
3. Paste your OpenRouter API key
4. (Optional) Select your preferred AI model
5. (Optional) Customize the prompt
6. Click "Test Connection" to verify your setup
7. Click "Save Settings"

## Usage

### Creating Flashcards

1. **Highlight text** on any webpage
2. **Right-click** the selected text
3. Select **"Create Flashcard"** from the context menu
4. Wait a few seconds for the AI to generate a definition
5. You'll see a notification when the flashcard is created

### Viewing Flashcards

1. Click the extension icon in your toolbar
2. Browse your flashcard collection
3. Use the search bar to find specific flashcards
4. Sort by newest, oldest, or alphabetically

### Managing Flashcards

- **Edit**: Click the ✏️ icon on any flashcard to edit the word or definition
- **Delete**: Click the 🗑️ icon to delete a flashcard
- **Search**: Use the search bar to filter flashcards by word, definition, or source URL
- **Sort**: Use the sort dropdown to organize your flashcards

## AI Models

The extension supports multiple AI models through OpenRouter:

| Model | Provider | Best For | Cost |
|-------|----------|----------|------|
| Claude 3.5 Sonnet | Anthropic | **Recommended** - Best quality definitions | Medium |
| Claude 3 Haiku | Anthropic | Fast responses, lower cost | Low |
| GPT-4 Turbo | OpenAI | High quality, detailed explanations | High |
| GPT-3.5 Turbo | OpenAI | Fast and affordable | Low |
| Grok Beta | xAI | Fast responses, good quality | Low-Medium |
| Llama 3.1 8B | Meta | Open source, very affordable | Very Low |
| Gemini Pro | Google | Good balance of quality and cost | Medium |

**Note**: Different models have different pricing. Check [OpenRouter pricing](https://openrouter.ai/models) for current rates.

## Default Prompt

The extension uses this default prompt for generating definitions:

```
You are a helpful English dictionary assistant. Provide a clear, concise definition for the following word or phrase. Include:

1. Part of speech
2. Definition (one or two sentences)
3. Example sentence using the word in context

Format your response in a clear, easy-to-understand manner suitable for a flashcard. Use markdown for formatting.
```

## Custom Prompts

You can customize the prompt to suit your needs:

### Examples

**Language Learning**:
```
Translate the following word to Spanish and provide:
1. Spanish translation
2. Part of speech
3. Example sentence in Spanish
4. Pronunciation guide

Word: {word}
```

**Technical Terms**:
```
Explain the following technical term as if teaching a beginner:
1. Simple definition
2. Real-world analogy
3. Common use case
4. Related concepts

Term: {word}
```

**Historical Context**:
```
Provide historical context for: {word}
Include:
1. Definition
2. Historical origin
3. How usage has evolved
4. Modern significance
```

## File Structure

```
highlight-flashcard/
├── manifest.json              # Extension configuration
├── background/
│   ├── background.js         # Service worker (context menu, orchestration)
│   └── api.js               # OpenRouter API client
├── lib/
│   └── storage.js           # Storage abstraction layer
├── ui/
│   ├── flashcards.html      # Main popup (flashcard viewer)
│   ├── flashcards.js        # Flashcard viewer logic
│   ├── flashcards.css       # Flashcard viewer styles
│   ├── settings.html        # Settings page
│   ├── settings.js          # Settings page logic
│   └── settings.css         # Settings page styles
├── icons/
│   ├── icon16.png          # Extension icon (16x16)
│   ├── icon48.png          # Extension icon (48x48)
│   └── icon128.png         # Extension icon (128x128)
├── specs/                  # Technical specifications
└── README.md              # This file
```

## Development

### Prerequisites

- Node.js (optional, for development tools)
- Chrome or Firefox browser
- OpenRouter API key

### Testing

1. Make changes to the code
2. Go to `chrome://extensions/` (or `about:debugging` in Firefox)
3. Click "Reload" on the extension
4. Test your changes

### Debugging

- **Background Service Worker**:
  - Chrome: `chrome://extensions/` → Click "Inspect views: service worker"
  - Firefox: `about:debugging` → Click "Inspect" next to the extension

- **Popup/Settings Pages**:
  - Right-click the popup or settings page
  - Select "Inspect"

- **Console Logs**:
  - All logs from `background.js` appear in the service worker console
  - All logs from UI pages appear in the page's dev tools console

## Storage Limits

- **Maximum Storage**: ~5MB (Chrome local storage limit)
- **Estimated Capacity**: 5,000-10,000 flashcards (depending on definition length)
- **Warning Threshold**: The extension will warn when storage exceeds 4MB

## Privacy & Security

- **Local Storage**: All flashcards are stored locally in your browser
- **No Tracking**: The extension does not track or collect any user data
- **API Key Security**: Your OpenRouter API key is stored locally and never shared
- **HTTPS Only**: All API requests use HTTPS encryption

## Troubleshooting

### "API key not configured" Error

- Go to Settings and enter your OpenRouter API key
- Make sure the key starts with `sk-or-`
- Click "Test Connection" to verify

### "Connection failed" Error

- Check your internet connection
- Verify your API key is valid
- Check your OpenRouter account has credits
- Try a different AI model

### Flashcards Not Saving

- Check browser storage is not full
- Try clearing old flashcards
- Check browser console for errors

### Context Menu Not Appearing

- Make sure text is selected
- Try reloading the extension
- Check extension permissions in browser settings

## Future Enhancements

- [ ] Spaced repetition algorithm for studying
- [ ] Export flashcards to CSV/Anki format
- [ ] Import flashcards from other sources
- [ ] Multiple language support
- [ ] Flashcard categories/tags
- [ ] Study mode with quizzes
- [ ] Sync across devices
- [ ] Offline mode with cached definitions
- [ ] Browser action badge with flashcard count
- [ ] Keyboard shortcuts for quick access

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Specification Documents

This project follows a spec-driven development approach. See the `specs/` directory for detailed specifications:

- [Main Specification](SPEC.md)
- [Storage Schema](specs/storage-schema.spec.md)
- [Context Menu](specs/context-menu.spec.md)
- [API Integration](specs/api-integration.spec.md)
- [Settings Page](specs/settings-page.spec.md)
- [Flashcard Viewer](specs/flashcard-viewer.spec.md)

## License

MIT License - see LICENSE file for details

## Support

For issues, questions, or suggestions:
- Open an issue on GitHub
- Check existing issues for solutions
- Review the troubleshooting section above

## Credits

- Uses [OpenRouter](https://openrouter.ai/) for AI model access
- Built with vanilla JavaScript (no frameworks)
- Icons: Simple custom design (feel free to replace with your own)

---

**Enjoy building your flashcard collection! 📚**
