// Netlify Function: Claude API proxy with in-memory rate limiting
// Rate limit: 2 runs per IP per 24 hours

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MAX_RUNS = 2;
const WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

// In-memory store — persists across warm invocations, resets on cold start
const rateLimitStore = {};

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const clientIP =
    event.headers['x-forwarded-for']?.split(',')[0].trim() ||
    event.headers['client-ip'] ||
    'unknown';

  try {
    // ── RATE LIMITING (in-memory) ──
    const now = Date.now();
    const key = clientIP;

    if (!rateLimitStore[key] || now - rateLimitStore[key].windowStart > WINDOW_MS) {
      rateLimitStore[key] = { count: 0, windowStart: now };
    }

    if (rateLimitStore[key].count >= MAX_RUNS) {
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
    if (!prompt || typeof prompt !== 'string' || prompt.length > 20000) {
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
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!claudeResponse.ok) {
      const err = await claudeResponse.text();
      console.error('Claude API error:', err);
      return { statusCode: 502, headers, body: JSON.stringify({ error: 'AI service error', detail: err }) };
    }

    const claudeData = await claudeResponse.json();
    const result = claudeData.content?.[0]?.text || '';

    // ── INCREMENT COUNTER ──
    rateLimitStore[key].count++;
    const runsLeft = MAX_RUNS - rateLimitStore[key].count;

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
      body: JSON.stringify({ error: 'Internal server error', detail: err.message }),
    };
  }
};
