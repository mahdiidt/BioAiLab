/**
 * Gene Explorer service.
 *
 * This is the only module in the codebase that talks to NCBI's public
 * Entrez E-utilities (esearch + esummary, db=gene) — routes/controllers/
 * frontend don't know these URLs exist, mirroring how services/providers/
 * isolates Groq/OpenAI from the rest of the app.
 *
 * No API key is required at this usage level: NCBI allows up to 3
 * requests/second without one. If BioAI Lab ever needs a higher rate,
 * an NCBI_API_KEY env var could be added later — this module is the
 * only place that would need to change.
 */
const BASE_URL = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
const REQUEST_TIMEOUT_MS = 10000;
const MAX_RESULTS = 10;

class GeneServiceError extends Error {
  constructor(code, message, status) {
    super(message);
    this.code = code;
    this.status = status || 502;
  }
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      throw new GeneServiceError('NCBI_ERROR', 'NCBI request failed with status ' + res.status, 502);
    }
    return await res.json();
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new GeneServiceError('NCBI_TIMEOUT', 'The request to NCBI timed out.', 504);
    }
    if (err instanceof GeneServiceError) throw err;
    throw new GeneServiceError('NCBI_NETWORK_ERROR', 'Could not reach NCBI.', 502);
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * @param {string} term - free-text gene search term (e.g. "TP53 human")
 * @returns {Promise<Array<{id, symbol, name, organism, chromosome, mapLocation, summary, url}>>}
 */
async function searchGenes(term) {
  const searchUrl =
    BASE_URL + '/esearch.fcgi?db=gene&retmode=json&retmax=' + MAX_RESULTS + '&term=' + encodeURIComponent(term);
  const searchData = await fetchJson(searchUrl);
  const ids = (searchData.esearchresult && searchData.esearchresult.idlist) || [];
  if (ids.length === 0) return [];

  const summaryUrl = BASE_URL + '/esummary.fcgi?db=gene&retmode=json&id=' + ids.join(',');
  const summaryData = await fetchJson(summaryUrl);
  const result = summaryData.result || {};
  const uids = result.uids || ids;

  return uids
    .map((uid) => {
      const g = result[uid];
      if (!g) return null;
      return {
        id: uid,
        symbol: g.name || '',
        name: g.description || '',
        organism: (g.organism && g.organism.scientificname) || '',
        chromosome: g.chromosome || '',
        mapLocation: g.maplocation || '',
        summary: g.summary || '',
        url: 'https://www.ncbi.nlm.nih.gov/gene/' + uid,
      };
    })
    .filter(Boolean);
}

module.exports = { searchGenes, GeneServiceError };
