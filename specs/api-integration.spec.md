# OpenRouter API Integration Specification

## Version
1.0.0

## API Overview
- **Provider**: OpenRouter
- **Base URL**: `https://openrouter.ai/api/v1`
- **Documentation**: https://openrouter.ai/docs
- **API Format**: OpenAI-compatible

## Authentication
- **Method**: Bearer token in Authorization header
- **Header**: `Authorization: Bearer {apiKey}`
- **Additional Headers**:
  - `HTTP-Referer`: Extension URL (for OpenRouter analytics)
  - `X-Title`: "Highlight Flashcard Extension"

## Endpoint
**POST** `/chat/completions`

### Request Structure
```json
{
  "model": "anthropic/claude-3.5-sonnet",
  "messages": [
    {
      "role": "system",
      "content": "{prompt template}"
    },
    {
      "role": "user",
      "content": "{selected word/phrase}"
    }
  ],
  "temperature": 0.7,
  "max_tokens": 500
}
```

### Response Structure
```json
{
  "id": "gen-xxxxxxxxxxxxx",
  "model": "anthropic/claude-3.5-sonnet",
  "choices": [
    {
      "message": {
        "role": "assistant",
        "content": "Definition text here..."
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 50,
    "completion_tokens": 100,
    "total_tokens": 150
  }
}
```

## Default Prompt Template
```
You are a helpful English dictionary assistant. Provide a clear, concise definition for the following word or phrase. Include:

1. Part of speech
2. Definition (one or two sentences)
3. Example sentence using the word in context

Format your response in a clear, easy-to-understand manner suitable for a flashcard. Use markdown for formatting.
```

## Supported Models
Default list of popular models (user can customize):
- `anthropic/claude-3.5-sonnet` (Recommended)
- `anthropic/claude-3-haiku`
- `openai/gpt-4-turbo`
- `openai/gpt-3.5-turbo`
- `meta-llama/llama-3.1-8b-instruct`
- `google/gemini-pro`

## Error Handling

### HTTP Status Codes
- **200**: Success
- **400**: Bad request (invalid parameters)
- **401**: Unauthorized (invalid API key)
- **402**: Payment required (insufficient credits)
- **429**: Too many requests (rate limit)
- **500**: Server error
- **503**: Service unavailable

### Error Response Format
```json
{
  "error": {
    "message": "Error description",
    "type": "invalid_request_error",
    "code": "invalid_api_key"
  }
}
```

### Error Handling Strategy
1. **Invalid API Key (401)**:
   - Clear cached API key
   - Show settings page
   - Message: "Invalid API key. Please update in settings."

2. **Rate Limit (429)**:
   - Check `Retry-After` header
   - Queue request for retry
   - Message: "Rate limit reached. Retrying in {n} seconds..."

3. **Network Error**:
   - Retry 3 times with exponential backoff (1s, 2s, 4s)
   - Message: "Network error. Retrying..."

4. **Server Error (500, 503)**:
   - Retry once after 5 seconds
   - Message: "Server error. Please try again later."

5. **Insufficient Credits (402)**:
   - Don't retry
   - Message: "Insufficient credits. Please check your OpenRouter account."

## API Client Interface

```javascript
class OpenRouterClient {
  constructor(apiKey, model);

  async createDefinition(word, prompt);
  // Returns: { success: boolean, definition?: string, error?: string }

  async testConnection();
  // Returns: { success: boolean, error?: string }

  static async getAvailableModels(apiKey);
  // Returns: { success: boolean, models?: Array, error?: string }
}
```

## Rate Limiting
- Implement client-side rate limiting: Max 10 requests per minute
- Queue excess requests
- Show queue status to user

## Response Processing
1. Extract `choices[0].message.content` from response
2. Trim whitespace
3. Validate not empty
4. Store with metadata (model, tokens used)

## Testing Requirements
- [ ] Successful API call with valid key
- [ ] Error handling for invalid key
- [ ] Error handling for rate limits
- [ ] Retry logic for network errors
- [ ] Prompt template variable substitution
- [ ] Response extraction and validation
- [ ] Handle empty/malformed responses

## Security Considerations
- Never log API keys
- API key stored in local storage only (not synced)
- Use HTTPS for all requests
- Validate API responses before processing
