const express = require('express');
const cors = require('cors');

const config = require('./config');
const chatRouter = require('./routes/chat');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.locals.aiProvider = config.aiProvider;

app.use(
  cors({
    origin: config.allowedOrigins.includes('*') ? true : config.allowedOrigins,
    methods: ['GET', 'POST'],
  })
);
app.use(express.json({ limit: '100kb' }));

// Simple health check — also reports (without leaking the key) whether
// a provider is configured, useful for frontend feature-detection later.
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    service: 'bioai-lab-backend',
    aiConfigured: config.isAiConfigured,
  });
});

app.use('/api/chat', chatRouter);

// 404 for anything else under /api
app.use('/api', (req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Unknown API route.' } });
});

app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`BioAI Lab backend listening on port ${config.port}`);
  console.log(`AI provider configured: ${config.isAiConfigured ? config.aiProvider : 'no (placeholder mode)'}`);
});
