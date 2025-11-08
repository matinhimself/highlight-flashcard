# Settings Page Specification

## Version
1.0.0

## Overview
A dedicated settings page where users can configure the extension's behavior, API credentials, and AI prompt.

## Page Access
- **URL**: `chrome-extension://{extension-id}/ui/settings.html`
- **Access Method**:
  - Click extension icon → "Settings" button
  - Right-click extension icon → "Options"
  - Chrome extensions page → Extension details → "Extension options"

## UI Components

### 1. API Configuration Section

#### OpenRouter API Key
- **Element**: Text input (password type with show/hide toggle)
- **Label**: "OpenRouter API Key"
- **Placeholder**: "sk-or-v1-..."
- **Validation**:
  - Not empty
  - Starts with "sk-or-"
  - Minimum 20 characters
- **Help Text**: "Get your API key from [openrouter.ai/keys](https://openrouter.ai/keys)"
- **Test Button**: "Test Connection" (validates API key)

#### Model Selection Mode
- **Element**: Radio buttons
- **Label**: "AI Model Selection"
- **Options**:
  - "Select from list" (default)
  - "Enter custom model ID"
- **Default**: Select from list

#### Preset Model Selection
- **Element**: Dropdown select
- **Label**: "Choose Model"
- **Options**:
  - Anthropic Claude 3.5 Sonnet (Recommended)
  - Anthropic Claude 3 Haiku (Faster, cheaper)
  - OpenAI GPT-4 Turbo
  - OpenAI GPT-3.5 Turbo
  - xAI Grok Beta (Fast)
  - Meta Llama 3.1 8B
  - Google Gemini Pro
- **Default**: Claude 3.5 Sonnet
- **Help Text**: "Different models have different costs and capabilities"
- **Visibility**: When "Select from list" is selected

#### Custom Model ID Input
- **Element**: Text input
- **Label**: "Custom Model ID"
- **Placeholder**: "e.g., anthropic/claude-3-opus or openai/gpt-4"
- **Validation**:
  - Not empty when custom model is selected
  - Warn if doesn't contain "/" (format: provider/model-name)
- **Help Text**: "Enter any OpenRouter model ID. See [available models](https://openrouter.ai/models)"
- **Visibility**: When "Enter custom model ID" is selected

### 2. Prompt Configuration Section

#### Prompt Mode Toggle
- **Element**: Radio buttons or toggle
- **Options**:
  - "Use Default Prompt" (recommended)
  - "Use Custom Prompt"
- **Default**: Use Default Prompt

#### Default Prompt Preview
- **Element**: Read-only textarea or collapsible panel
- **Label**: "Default Prompt"
- **Content**: Shows the default prompt template
- **Visibility**: When "Use Default Prompt" is selected

#### Custom Prompt Editor
- **Element**: Textarea (auto-expanding)
- **Label**: "Custom Prompt"
- **Placeholder**: "Enter your custom prompt. Use {word} as placeholder for the selected text."
- **Rows**: 10
- **Character Count**: Show current length
- **Validation**:
  - Maximum 2000 characters
  - Warn if {word} placeholder not found
- **Visibility**: When "Use Custom Prompt" is selected
- **Help Text**: "Tip: Use {word} as a placeholder for the selected text"

### 3. Actions Section

#### Save Button
- **Label**: "Save Settings"
- **Behavior**:
  - Validate all inputs
  - Save to storage
  - Show success message
  - Disable button until changes made
- **Style**: Primary button (prominent)

#### Reset Button
- **Label**: "Reset to Defaults"
- **Behavior**:
  - Confirm with user
  - Reset all settings to defaults
  - Reload form
- **Style**: Secondary button

#### Cancel Button (if changes unsaved)
- **Label**: "Cancel"
- **Behavior**: Discard changes and reload from storage

### 4. Status/Feedback Section

#### Connection Status
- **Display**: Badge or status indicator
- **States**:
  - ✓ Connected (green)
  - ✗ Not configured (yellow)
  - ✗ Connection failed (red)
- **Location**: Near API key input

#### Notification Area
- **Element**: Dismissible notification banner
- **Types**:
  - Success (green): "Settings saved successfully"
  - Error (red): "Failed to save: {error}"
  - Warning (yellow): "API key not tested"
  - Info (blue): Tips and help messages

## Layout Structure

```
+------------------------------------------+
|  Settings - Highlight Flashcard         |
+------------------------------------------+
|                                          |
|  [API Configuration]                     |
|  OpenRouter API Key: [____________] [👁] |
|  Get your key from openrouter.ai         |
|  [Test Connection]  [✓ Connected]        |
|                                          |
|  AI Model: [Claude 3.5 Sonnet ▼]        |
|                                          |
|  [Prompt Configuration]                  |
|  ( ) Use Default Prompt                  |
|  (•) Use Custom Prompt                   |
|                                          |
|  Custom Prompt:                          |
|  +--------------------------------------+|
|  |                                      ||
|  | Enter your prompt here...            ||
|  |                                      ||
|  +--------------------------------------+|
|  {word} placeholder will be replaced     |
|  Characters: 245 / 2000                  |
|                                          |
|  [Save Settings]  [Reset to Defaults]   |
|                                          |
+------------------------------------------+
```

## Behavior Specifications

### On Page Load
1. Load settings from storage
2. Populate all form fields
3. Check API connection status (async)
4. Disable Save button (no changes yet)

### On Field Change
1. Enable Save button
2. Mark form as dirty
3. Validate field in real-time
4. Show validation errors inline

### On Test Connection Click
1. Validate API key format first
2. Show loading spinner
3. Make test API call (minimal request)
4. Show result (success/error)
5. Update connection status badge

### On Save Click
1. Validate all fields
2. Show saving indicator
3. Save to storage
4. Show success message
5. Disable Save button
6. Mark form as clean

### On Reset Click
1. Show confirmation dialog: "Reset all settings to defaults?"
2. If confirmed:
   - Clear storage
   - Reload defaults
   - Update form
   - Show success message

## Validation Rules

### API Key
- Required
- Must start with "sk-or-"
- Minimum 20 characters
- No whitespace

### Model
- Required
- Must be from predefined list

### Custom Prompt
- Maximum 2000 characters
- Warn if {word} placeholder not found (but allow)

## Keyboard Shortcuts
- `Ctrl/Cmd + S`: Save settings
- `Ctrl/Cmd + R`: Reset to defaults (with confirmation)
- `Esc`: Cancel (if changes unsaved)

## Accessibility
- All inputs have labels
- Use semantic HTML
- Keyboard navigation support
- ARIA labels for status indicators
- Focus management for modals

## Responsive Design
- Minimum width: 400px
- Maximum width: 800px
- Center-aligned on page
- Mobile-friendly (for mobile extension managers)

## Testing Checklist
- [ ] Load existing settings correctly
- [ ] Save settings successfully
- [ ] Validate API key format
- [ ] Test connection button works
- [ ] Model selection persists
- [ ] Prompt toggle switches correctly
- [ ] Custom prompt saves and loads
- [ ] Reset button works with confirmation
- [ ] Error messages display correctly
- [ ] Success messages display correctly
- [ ] Keyboard shortcuts work
- [ ] Form dirty state tracking works
