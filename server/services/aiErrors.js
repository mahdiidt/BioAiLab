/**
 * Error types used across the AI service layer. Kept in their own module
 * so both aiProvider.js and individual provider adapters (e.g.
 * providers/openaiProvider.js) can import them without a circular
 * require between aiProvider.js <-> providers/*.js.
 */

class AiNotConfiguredError extends Error {
  constructor(message) {
    super(message || 'AI provider is not configured yet.');
    this.name = 'AiNotConfiguredError';
    this.code = 'AI_NOT_CONFIGURED';
    this.status = 503;
  }
}

/**
 * Generic error for anything that goes wrong while actually talking to a
 * provider (auth, rate limits, timeouts, network errors, bad/empty
 * responses, etc). `code` is a stable machine-readable label the
 * controller uses to pick a safe client-facing message; `status` is the
 * HTTP status the controller should respond with.
 */
class AiProviderError extends Error {
  constructor(code, message, opts) {
    super(message);
    opts = opts || {};
    this.name = 'AiProviderError';
    this.code = code;
    this.status = opts.status || 502;
    this.retryable = Boolean(opts.retryable);
  }
}

module.exports = { AiNotConfiguredError, AiProviderError };
