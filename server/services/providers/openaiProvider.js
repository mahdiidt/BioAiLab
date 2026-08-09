/**
 * OpenAI adapter.
 *
 * This is the only module in the codebase that imports/talks to the
 * OpenAI SDK. services/aiProvider.js picks this adapter based on
 * AI_PROVIDER=openai and calls generateReply(messages, config) — nothing
 * else in the app (routes, controllers, frontend) knows OpenAI exists.
 */
const OpenAI = require('openai');
const { AiProviderError } = require('../aiErrors');

const REQUEST_TIMEOUT_MS = 20000;
const DEFAULT_MODEL = 'gpt-4o-mini';
const MAX_OUTPUT_TOKENS = 500;

const SYSTEM_PROMPT =
  'You are Bio Copilot, the research assistant built into BioAI Lab. ' +
  'You help researchers and students with molecular biology, genetics and ' +
  'bioinformatics questions. Be accurate and concise, and say clearly when ' +
  'you are not certain rather than guessing.';

var cachedClient = null;
var cachedKey = null;

function getClient(apiKey) {
  // Re-create the client if the key changes (e.g. between test runs);
  // otherwise reuse it so we're not constructing a new client per request.
  if (!cachedClient || cachedKey !== apiKey) {
    cachedClient = new OpenAI({
      apiKey: apiKey,
      timeout: REQUEST_TIMEOUT_MS,
      maxRetries: 1,
    });
    cachedKey = apiKey;
  }
  return cachedClient;
}

/**
 * Converts the app's existing { role, content } message format into
 * OpenAI's expected shape. The app already uses 'user' | 'assistant' |
 * 'system' roles, so this is mostly a safe pass-through plus a default
 * system prompt if the caller didn't supply one.
 */
function toOpenAiMessages(messages) {
  var cleaned = (messages || [])
    .filter(function (m) {
      return m && typeof m.content === 'string' && m.content.trim().length > 0;
    })
    .map(function (m) {
      var role = ['user', 'assistant', 'system'].indexOf(m.role) !== -1 ? m.role : 'user';
      return { role: role, content: m.content.trim() };
    });

  if (cleaned.length === 0 || cleaned[0].role !== 'system') {
    cleaned.unshift({ role: 'system', content: SYSTEM_PROMPT });
  }
  return cleaned;
}

/**
 * @param {Array<{role: string, content: string}>} messages
 * @param {{aiApiKey: string, aiModel: string}} config
 * @returns {Promise<string>} the assistant reply text
 */
async function generateReply(messages, config) {
  var client = getClient(config.aiApiKey);
  var model = config.aiModel || DEFAULT_MODEL;

  var completion;
  try {
    completion = await client.chat.completions.create(
      {
        model: model,
        messages: toOpenAiMessages(messages),
        temperature: 0.4,
        max_tokens: MAX_OUTPUT_TOKENS,
      },
      { timeout: REQUEST_TIMEOUT_MS }
    );
  } catch (err) {
    throw mapOpenAiError(err);
  }

  var reply =
    completion &&
    completion.choices &&
    completion.choices[0] &&
    completion.choices[0].message &&
    completion.choices[0].message.content;

  if (!reply || !reply.trim()) {
    throw new AiProviderError('EMPTY_RESPONSE', 'OpenAI returned an empty response.', {
      status: 502,
      retryable: true,
    });
  }

  return reply.trim();
}

/**
 * Translates OpenAI SDK errors into our own AiProviderError so the
 * controller never has to know anything about OpenAI's error shapes,
 * and so raw provider error text (which can include account/billing
 * detail) never reaches the client.
 */
function mapOpenAiError(err) {
  var status = err && err.status;

  if (status === 401 || status === 403) {
    return new AiProviderError('PROVIDER_AUTH_ERROR', 'OpenAI rejected the configured API key.', {
      status: 502,
    });
  }
  if (status === 429) {
    return new AiProviderError('RATE_LIMITED', 'OpenAI rate limit reached.', {
      status: 429,
      retryable: true,
    });
  }
  if (status === 400) {
    return new AiProviderError('PROVIDER_BAD_REQUEST', 'OpenAI rejected the request as invalid.', {
      status: 502,
    });
  }
  if (typeof status === 'number' && status >= 500) {
    return new AiProviderError('PROVIDER_UNAVAILABLE', 'OpenAI is temporarily unavailable.', {
      status: 502,
      retryable: true,
    });
  }
  if (
    err &&
    (err.name === 'APIConnectionTimeoutError' || err.code === 'ETIMEDOUT' || err.type === 'request-timeout')
  ) {
    return new AiProviderError('PROVIDER_TIMEOUT', 'The request to OpenAI timed out.', {
      status: 504,
      retryable: true,
    });
  }
  if (err && (err.name === 'APIConnectionError' || err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND')) {
    return new AiProviderError('PROVIDER_NETWORK_ERROR', 'Could not reach OpenAI.', {
      status: 502,
      retryable: true,
    });
  }

  return new AiProviderError('PROVIDER_ERROR', 'OpenAI request failed.', {
    status: 502,
    retryable: true,
  });
}

module.exports = { generateReply };
