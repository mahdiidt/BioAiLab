/**
 * Provider-agnostic AI service.
 *
 * The rest of the backend (routes/controllers) only ever calls
 * `generateReply(messages)`. It never knows or cares whether that ends up
 * calling OpenAI, Claude, or anything else — that decision lives entirely
 * behind this module, driven by the AI_PROVIDER env var.
 *
 * PHASE 3C: the 'openai' adapter is wired in.
 * PHASE 3D: the 'groq' adapter is now wired in too. Adding another
 * provider later means adding services/providers/<name>Provider.js and
 * one more `case` below — routes, controllers and the frontend never change.
 */
const config = require('../config');
const { AiNotConfiguredError, AiProviderError } = require('./aiErrors');

/**
 * @param {Array<{role: 'user'|'assistant'|'system', content: string}>} messages
 * @returns {Promise<string>} the assistant's reply text
 */
async function generateReply(messages) {
  if (!config.isAiConfigured) {
    throw new AiNotConfiguredError();
  }

  switch (config.aiProvider) {
    case 'openai':
      return require('./providers/openaiProvider').generateReply(messages, config);
    case 'groq':
      return require('./providers/groqProvider').generateReply(messages, config);
    default:
      throw new AiNotConfiguredError('Unknown AI_PROVIDER "' + config.aiProvider + '".');
  }
}

module.exports = { generateReply, AiNotConfiguredError, AiProviderError };
