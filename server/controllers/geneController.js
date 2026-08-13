const { searchGenes, GeneServiceError } = require('../services/geneService');

/**
 * GET /api/genes?q=<term>
 * Success (200): { genes: [{ id, symbol, name, organism, chromosome, mapLocation, summary, url }, ...] }
 * Validation errors (400): { error: { code, message } }
 * NCBI errors (502/504): { error: { code, message } } — safe, generic message only
 */
async function getGenes(req, res, next) {
  try {
    const term = (req.query.q || '').trim();

    if (!term) {
      return res.status(400).json({
        error: { code: 'MISSING_QUERY', message: 'Query parameter "q" is required.' },
      });
    }
    if (term.length > 200) {
      return res.status(400).json({
        error: { code: 'QUERY_TOO_LONG', message: 'Search term must be 200 characters or fewer.' },
      });
    }

    const genes = await searchGenes(term);
    return res.status(200).json({ genes });
  } catch (err) {
    if (err instanceof GeneServiceError) {
      // Log full detail server-side only; the client only ever sees a
      // generic, code-tagged message.
      console.error('[bioai-lab-backend] Gene service error:', err.code, err.message);
      return res.status(err.status || 502).json({
        error: { code: err.code, message: safeMessageFor(err.code) },
      });
    }
    return next(err);
  }
}

function safeMessageFor(code) {
  switch (code) {
    case 'NCBI_TIMEOUT':
      return 'The gene database took too long to respond. Please try again.';
    case 'NCBI_NETWORK_ERROR':
      return 'Could not reach the gene database. Please try again.';
    default:
      return 'The gene database is temporarily unavailable. Please try again later.';
  }
}

module.exports = { getGenes };
