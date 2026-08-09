const { generateReply, AiNotConfiguredError, AiProviderError } = require('../services/aiProvider');

/**
 * POST /api/chat
 * Body:  { messages: [{ role, content }, ...] }
 * Success (200): { reply: string, provider: string }
 * Not configured (503): { error: { code: 'AI_NOT_CONFIGURED', message } }
 * Provider error (429/502/504): { error: { code, message } } — safe, generic message only
 * Validation errors (400): handled by validateChatRequest middleware.
 */
async function handleChat(req, res, next) {
  try {
    const { messages } = req.body;

    const reply = await generateReply(messages);

    return res.status(200).json({
      reply,
      provider: req.app.locals.aiProvider,
    });
  } catch (err) {
    if (err instanceof AiNotConfiguredError) {
      // Not an error in the app — just a clean, explicit "not live yet" signal
      // the frontend can use to fall back to its own placeholder response.
      return res.status(503).json({
        error: {
          code: err.code,
          message: 'Bio Copilot backend is not connected to an AI provider yet.',
        },
      });
    }

    if (err instanceof AiProviderError) {
      // Log full detail server-side only; the client only ever sees a
      // generic, code-tagged message — never the provider's raw error text.
      console.error('[bioai-lab-backend] AI provider error:', err.code, err.message);
      return res.status(err.status || 502).json({
        error: {
          code: err.code,
          message: safeMessageFor(err.code),
        },
      });
    }

    return next(err);
  }
}

function safeMessageFor(code) {
  switch (code) {
    case 'RATE_LIMITED':
      return 'The AI service is receiving too many requests right now. Please try again shortly.';
    case 'PROVIDER_TIMEOUT':
      return 'The AI service took too long to respond. Please try again.';
    case 'PROVIDER_NETWORK_ERROR':
      return 'Could not reach the AI service. Please try again.';
    case 'EMPTY_RESPONSE':
      return 'The AI service returned an empty response. Please try again.';
    default:
      return 'The AI service is temporarily unavailable. Please try again later.';
  }
}

module.exports = { handleChat };
