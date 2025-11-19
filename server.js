// server.js
// KonectFeed API – production-ready Express server using Supabase

import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { createClient } from '@supabase/supabase-js';

const app = express();
const PORT = process.env.PORT || 8080;

// ---- Supabase client -------------------------------------------------------

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY env vars');
  throw new Error('Supabase configuration missing');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
});

// ---- Middleware ------------------------------------------------------------

app.use(cors());
app.use(express.json());
app.use(morgan('tiny'));

// ---- Health check ----------------------------------------------------------

app.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'konectfeed-api',
  });
});

// ---- Search endpoint -------------------------------------------------------
// GET /search/businesses
// Query params:
//   q          – generic search term (service, treatment, keyword)
//   city       – city name (ex: "Phoenix")
//   category   – category name (ex: "Medspa", "Accountant")
//   max_price  – numeric max price filter
//   limit      – number of results (default 10, max 25)

app.get('/search/businesses', async (req, res) => {
  try {
    const { q, city, category, max_price, limit } = req.query;

    // Base select – keep only the fields you actually need in GPT
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
        price,
        offer_title,
        offer_description,
        image_url,
        buy_url,
        book_url,
        tags,
        is_sponsored,
        score
      `
      );

    // City filter (case-insensitive)
    if (city) {
      query = query.ilike('city', `%${city}%`);
    }

    // Category filter (case-insensitive)
    if (category) {
      query = query.ilike('category', `%${category}%`);
    }

    // Price filter
    if (max_price) {
      const maxPriceNum = Number(max_price);
      if (!Number.isNaN(maxPriceNum)) {
        query = query.lte('price', maxPriceNum);
      }
    }

    // Full-text-ish search across multiple fields, including tags[]
    if (q) {
      const term = q.trim();

      query = query.or(
        [
          `business_name.ilike.%${term}%`,
          `category.ilike.%${term}%`,
          `subcategory.ilike.%${term}%`,
          `city.ilike.%${term}%`,
          `offer_title.ilike.%${term}%`,
          `offer_description.ilike.%${term}%`,
          // IMPORTANT FIX: cast tags[] to text to avoid "operator does not exist: text[] ~~* unknown"
          `tags::text.ilike.%${term}%`,
        ].join(',')
      );
    }

    // Sort: sponsored first, then by score, then by rating
    query = query
      .order('is_sponsored', { ascending: false, nullsFirst: false })
      .order('score', { ascending: false, nullsFirst: false })
      .order('rating', { ascending: false, nullsFirst: false });

    // Limit / pagination
    const pageSize = Math.min(Number(limit) || 10, 25);
    query = query.limit(pageSize);

    const { data, error } = await query;

    if (error) {
      console.error('❌ Supabase error in /search/businesses:', error);
      return res.status(500).json({ error: 'Failed to search businesses' });
    }

    // Always return a stable shape for GPT
    return res.json({
      results: data || [],
      count: data ? data.length : 0,
    });
  } catch (err) {
    console.error('❌ Unexpected error in /search/businesses:', err);
    return res.status(500).json({ error: 'Failed to search businesses' });
  }
});

// ---- 404 handler -----------------------------------------------------------

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ---- Start server ----------------------------------------------------------

app.listen(PORT, () => {
  console.log(`✅ KonectFeed API running on port ${PORT}`);
});
