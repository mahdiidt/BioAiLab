const MAX_MESSAGES = 50;
const MAX_MESSAGE_LENGTH = 4000;
const ALLOWED_ROLES = ['user', 'assistant', 'system'];

/**
 * Validates the POST /api/chat request body before it reaches the controller.
 * Expected shape:
 *   { "messages": [ { "role": "user", "content": "..." }, ... ] }
 */
function validateChatRequest(req, res, next) {
  const body = req.body;

  if (!body || typeof body !== 'object') {
    return res.status(400).json({
      error: { code: 'INVALID_BODY', message: 'Request body must be a JSON object.' },
    });
  }

  const { messages } = body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({
      error: { code: 'INVALID_MESSAGES', message: '"messages" must be a non-empty array.' },
    });
  }

  if (messages.length > MAX_MESSAGES) {
    return res.status(400).json({
      error: {
        code: 'TOO_MANY_MESSAGES',
        message: `"messages" cannot contain more than ${MAX_MESSAGES} items.`,
      },
    });
  }

  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (!m || typeof m !== 'object') {
      return res.status(400).json({
        error: { code: 'INVALID_MESSAGE', message: `messages[${i}] must be an object.` },
      });
    }
    if (!ALLOWED_ROLES.includes(m.role)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_ROLE',
          message: `messages[${i}].role must be one of: ${ALLOWED_ROLES.join(', ')}.`,
        },
      });
    }
    if (typeof m.content !== 'string' || !m.content.trim()) {
      return res.status(400).json({
        error: { code: 'INVALID_CONTENT', message: `messages[${i}].content must be a non-empty string.` },
      });
    }
    if (m.content.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({
        error: {
          code: 'MESSAGE_TOO_LONG',
          message: `messages[${i}].content exceeds ${MAX_MESSAGE_LENGTH} characters.`,
        },
      });
    }
  }

  next();
}

module.exports = validateChatRequest;
