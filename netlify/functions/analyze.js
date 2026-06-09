// Netlify Function: Claude API proxy with IP-based rate limiting
// Rate limit: 2 runs per IP per 24 hours (stored in Netlify Blobs)

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MAX_RUNS = 2;
const WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

exports.handler = async (event) => {
  // CORS headers — update the origin to your actual Netlify/Squarespace domain
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // Get client IP for rate limiting
  const clientIP =
    event.headers['x-forwarded-for']?.split(',')[0].trim() ||
    event.headers['client-ip'] ||
    'unknown';

  try {
    // ── RATE LIMITING via Netlify Blobs ──
    const { getStore } = require('@netlify/blobs');
    const store = getStore('rate-limits');

    const key = `ip_${clientIP.replace(/\./g, '_').replace(/:/g, '_')}`;
    const now = Date.now();

    let record = { count: 0, windowStart: now };

    try {
      const existing = await store.get(key, { type: 'json' });
      if (existing) {
        // Reset window if 24h have passed
        if (now - existing.windowStart > WINDOW_MS) {
          record = { count: 0, windowStart: now };
        } else {
          record = existing;
        }
      }
    } catch (_) {
      // No existing record — first request from this IP
    }

    if (record.count >= MAX_RUNS) {
      return {
        statusCode: 429,
        headers,
        body: JSON.stringify({
          error: 'rate_limited',
          message: `You've used your ${MAX_RUNS} free runs for today. Resets in 24 hours.`,
        }),
      };
    }

    // ── PARSE REQUEST ──
    let body;
    try {
      body = JSON.parse(event.body);
    } catch {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid request body' }) };
    }

    const { prompt } = body;
    if (!prompt || typeof prompt !== 'string' || prompt.length > 8000) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid prompt' }) };
    }

    // ── CALL CLAUDE API ──
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'API not configured' }) };
    }

    const claudeResponse = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!claudeResponse.ok) {
      const err = await claudeResponse.text();
      console.error('Claude API error:', err);
      return { statusCode: 502, headers, body: JSON.stringify({ error: 'AI service error' }) };
    }

    const claudeData = await claudeResponse.json();
    const result = claudeData.content?.[0]?.text || '';

    // ── INCREMENT RATE LIMIT COUNTER ──
    record.count++;
    await store.setJSON(key, record, { ttl: Math.ceil(WINDOW_MS / 1000) });

    const runsLeft = MAX_RUNS - record.count;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ result, runsLeft }),
    };

  } catch (err) {
    console.error('Function error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
