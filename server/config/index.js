/**
 * Central server configuration.
 * Everything provider-related comes from environment variables so no
 * API key or provider choice is ever hardcoded or shipped to the client.
 */
require('dotenv').config();

const config = {
  port: parseInt(process.env.PORT, 10) || 3001,

  // Comma-separated list of origins allowed to call this API (your frontend's origin(s)).
  allowedOrigins: (process.env.ALLOWED_ORIGIN || 'http://localhost:5500')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),

  // Which AI provider adapter to use. 'none' until a provider is wired up.
  aiProvider: (process.env.AI_PROVIDER || 'none').toLowerCase(),

  // The single, generic key name requested for phase 3B.
  // Never logged, never sent to the client, never given a default value.
  aiApiKey: process.env.AI_API_KEY || '',

  // Optional model override, provider-specific, also from env.
  aiModel: process.env.AI_MODEL || '',
};

Object.defineProperty(config, 'isAiConfigured', {
  get() {
    return Boolean(config.aiApiKey) && config.aiProvider !== 'none';
  },
});

module.exports = config;
