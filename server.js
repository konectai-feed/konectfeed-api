// server.js  – KonectFeed API (ESM version)

import express from 'express';
import cors from 'cors';
import pkg from '@supabase/supabase-js';

const { createClient } = pkg;

const app = express();
const PORT = process.env.PORT || 8080;

// Read from Render environment (NOT from .env in GitHub)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY env vars');
  throw new Error('Supabase URL and service key are required');
}

const supabase = createClient(supabaseUrl, supabaseKey);

app.use(cors());
app.use(express.json());

// Simple health check
app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'konectfeed-api' });
});

/**
 * GET /search/businesses
 * Query params:
 *   q         – search term (e.g. "hydrafacial")
 *   city      – city name (e.g. "Phoenix")
 *   category  – category (e.g. "medspa")
 *   max_price – max price filter (number)
 *   limit     – max # of results (default 10, max 20)
 */
app.get('/search/businesses', async (req, res) => {
  try {
    const { q, city, category, max_price, limit } = req.query;

    let query = supabase.from('feed_items').select('*');

    if (city) {
      query = query.eq('city', city);
    }

    if (category) {
      query = query.eq('category', category);
    }

    if (max_price) {
      const mp = Number(max_price);
      if (!Number.isNaN(mp)) {
        query = query.lte('price', mp);
      }
    }

    if (q && q.trim()) {
      const term = `%${q.trim()}%`;
      // Match on business name, offer title, offer description, or tags
      query = query.or(
        [
          `business_name.ilike.${term}`,
          `offer_title.ilike.${term}`,
          `offer_description.ilike.${term}`,
          `tags.ilike.${term}`
        ].join(',')
      );
    }

    const safeLimit = Math.min(Number(limit) || 10, 20);

    query = query
      .order('is_sponsored', { ascending: false })
      .order('score', { ascending: false, nullsLast: true })
      .order('rating', { ascending: false, nullsLast: true })
      .limit(safeLimit);

    const { data, error } = await query;

    if (error) {
      console.error('Supabase error in /search/businesses:', error);
      return res.status(500).json({ error: 'Failed to search businesses' });
    }

    res.json({ results: data ?? [] });
  } catch (err) {
    console.error('Unexpected error in /search/businesses:', err);
    res.status(500).json({ error: 'Failed to search businesses' });
  }
});

app.listen(PORT, () => {
  console.log(`KonectFeed API running on port ${PORT}`);
});

export default app;
