// server.js - KonectFeed API

import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';

const app = express();
const port = process.env.PORT || 8080;

// --- Supabase setup ---
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl) {
  throw new Error('SUPABASE_URL env var is required');
}
if (!supabaseServiceKey) {
  throw new Error('SUPABASE_SERVICE_KEY env var is required');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// --- Middleware ---
app.use(cors());
app.use(express.json());

// --- Health check ---
app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'konectfeed-api' });
});

// --- Categories endpoint ---
// Returns distinct categories from feed_items
app.get('/categories', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('feed_items')
      .select('category', { distinct: true })
      .neq('category', null)
      .order('category', { ascending: true });

    if (error) {
      console.error('Error loading categories:', error);
      return res.status(500).json({ error: 'Failed to load categories' });
    }

    const categories = (data || []).map((row) => row.category);
    res.json({ categories });
  } catch (err) {
    console.error('Unexpected error in /categories:', err);
    res.status(500).json({ error: 'Unexpected server error' });
  }
});

// --- Main search endpoint ---
// GET /search/businesses?q=&city=&category=&max_price=&limit=
app.get('/search/businesses', async (req, res) => {
  try {
    const {
      q,
      city,
      category,
      max_price: maxPriceParam,
      limit: limitParam,
    } = req.query;

    // limit guardrails
    let limit = parseInt(limitParam, 10);
    if (Number.isNaN(limit) || limit <= 0) limit = 5;
    if (limit > 20) limit = 20;

    // price filter
    let maxPrice = maxPriceParam ? Number(maxPriceParam) : undefined;
    if (Number.isNaN(maxPrice)) {
      maxPrice = undefined;
    }

    // base select
    let query = supabase
      .from('feed_items')
      .select(
        `
        id,
        business_name,
        category,
        subcategory,
        city,
        state,
        address,
        zip,
        phone,
        email,
        website,
        rating,
        reviews_count,
        offer_title,
        offer_description,
        price,
        min_price,
        max_price,
        image_url,
        buy_url,
        book_url,
        tags,
        is_sponsored,
        score
      `
      )
      .limit(limit);

    // city filter (case-insensitive equality)
    if (city) {
      query = query.ilike('city', city);
      // if you want partial match: query = query.ilike('city', `%${city}%`);
    }

    // category filter (case-insensitive equality)
    if (category) {
      query = query.ilike('category', category);
      // or partial: query = query.ilike('category', `%${category}%`);
    }

    // simple keyword match on offer_title (good for "hydrafacial", "botox", etc.)
    if (q) {
      query = query.ilike('offer_title', `%${q}%`);
    }

    // price filter: match rows where min_price OR price <= maxPrice
    if (maxPrice !== undefined) {
      query = query.or(`min_price.lte.${maxPrice},price.lte.${maxPrice}`);
    }

    // ordering: sponsored first, then score, then rating
    query = query
      .order('is_sponsored', { ascending: false, nullsFirst: false })
      .order('score', { ascending: false, nullsLast: true })
      .order('rating', { ascending: false, nullsLast: true });

    const { data, error } = await query;

    if (error) {
      console.error('Error in /search/businesses:', error);
      return res.status(500).json({ error: 'Failed to search businesses' });
    }

    res.json({ results: data ?? [] });
  } catch (err) {
    console.error('Unexpected error in /search/businesses:', err);
    res.status(500).json({ error: 'Unexpected server error' });
  }
});

// --- Usage tracking endpoint ---
// POST /usage/track  (used by the GPT for simple analytics)
app.post('/usage/track', async (req, res) => {
  try {
    const event = req.body || {};
    console.log('Usage event:', JSON.stringify(event));
    // Future: insert into a Supabase "usage_events" table.
    res.json({ ok: true });
  } catch (err) {
    console.error('Error in /usage/track:', err);
    res.status(500).json({ error: 'Unexpected server error' });
  }
});

// --- Start server ---
app.listen(port, () => {
  console.log(`KonectFeed API listening on port ${port}`);
});
