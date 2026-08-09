# BioAI Lab — Bio Copilot Backend

Provider-agnostic Express backend for the Bio Copilot chat feature.
Phase 3C connects it to OpenAI as the active provider.

## Setup

```bash
cd server
npm install
cp .env.example .env
```

## Configuring the OpenAI API key

1. Create an API key at https://platform.openai.com/api-keys (requires an OpenAI account with billing set up).
2. Open `server/.env` (create it from `.env.example` if you haven't yet).
3. Set:
   ```
   AI_PROVIDER=openai
   AI_API_KEY=sk-...your real key...
   AI_MODEL=gpt-4o-mini
   ```
   `AI_MODEL` can be any chat model your account has access to (e.g. `gpt-4o`, `gpt-4o-mini`, `gpt-4.1`). Leave it blank to default to `gpt-4o-mini`.
4. Save `.env`. **Never commit it** — it's already listed in `.gitignore`.
5. Start the server:
   ```bash
   npm start
   ```
6. Confirm it's live:
   ```bash
   curl http://localhost:3001/api/health
   # { "ok": true, "service": "bioai-lab-backend", "aiConfigured": true }
   ```
7. Test the chat endpoint:
   ```bash
   curl -X POST http://localhost:3001/api/chat \
     -H "Content-Type: application/json" \
     -d '{"messages":[{"role":"user","content":"What does GC content tell you about a DNA sequence?"}]}'
   ```

The key only ever lives in `server/.env` / your host's environment variable
settings. It is read once by `config/index.js`, used only inside
`services/providers/openaiProvider.js` to construct the OpenAI client, and
is never included in any API response, log line, or file sent to the
browser.

The frontend itself is unchanged in this phase — it still uses its local
placeholder replies (`USE_BACKEND = false` in the Bio Copilot script).
Flipping that flag and pointing it at a deployed `/api/chat` is a
separate, later step.

## Endpoint: POST /api/chat

**Request body**

```json
{
  "messages": [
    { "role": "user", "content": "Explain CRISPR in one sentence." }
  ]
}
```

`role` must be `user`, `assistant`, or `system`. `content` must be a non-empty
string under 4000 characters. Max 50 messages per request.

**Responses**

| Case | Status | Body |
|---|---|---|
| Invalid request | 400 | `{ "error": { "code": "...", "message": "..." } }` |
| No AI provider configured | 503 | `{ "error": { "code": "AI_NOT_CONFIGURED", "message": "..." } }` |
| OpenAI auth/config problem | 502 | `{ "error": { "code": "PROVIDER_AUTH_ERROR", "message": "..." } }` |
| OpenAI rate limit | 429 | `{ "error": { "code": "RATE_LIMITED", "message": "..." } }` |
| OpenAI timeout | 504 | `{ "error": { "code": "PROVIDER_TIMEOUT", "message": "..." } }` |
| OpenAI unreachable | 502 | `{ "error": { "code": "PROVIDER_NETWORK_ERROR", "message": "..." } }` |
| OpenAI returned nothing usable | 502 | `{ "error": { "code": "EMPTY_RESPONSE", "message": "..." } }` |
| Success | 200 | `{ "reply": "...", "provider": "openai" }` |
| Unexpected server error | 500 | `{ "error": { "code": "INTERNAL_ERROR", "message": "..." } }` |

All error messages returned to the client are generic and code-tagged —
raw OpenAI error text (which can include account/billing detail) is only
ever logged server-side, never sent to the browser.

The frontend already treats any non-200 response (or a network failure)
as a signal to fall back to its local placeholder reply, so once
`USE_BACKEND` is switched on, all of the error cases above degrade
gracefully in the UI instead of breaking the chat.

## Adding another provider later

`services/aiProvider.js` picks a provider by name via the `AI_PROVIDER`
env var and delegates to `services/providers/<name>Provider.js`. To add
Claude or another provider, create `services/providers/anthropicProvider.js`
with the same `generateReply(messages, config)` shape and add one more
`case` to the switch in `aiProvider.js`. Nothing in `routes/`,
`controllers/`, or the frontend needs to change.

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `PORT` | no (defaults to 3001) | Port the server listens on |
| `ALLOWED_ORIGIN` | recommended | Comma-separated list of allowed CORS origins |
| `AI_PROVIDER` | yes, for live replies | `openai` to enable OpenAI, or `none` to stay in "not configured" mode |
| `AI_API_KEY` | yes, for live replies | Your OpenAI secret key. Server-side only |
| `AI_MODEL` | no (defaults to `gpt-4o-mini`) | Which OpenAI chat model to use |
