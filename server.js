// server.js
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const app = express();
const port = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('tiny'));

// Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('SUPABASE_URL or SUPABASE_*_KEY is missing in environment');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'konectfeed-api' });
});

/**
 * GET /search/businesses
 * Query params:
 *  - q:         text search (business name, city, category, sub_category)
 *  - city:      city filter
 *  - category:  category filter
 *  - max_price: numeric price ceiling
 *  - limit:     max results (default 10, max 50)
 */
app.get('/search/businesses', async (req, res) => {
  const { q, city, category, max_price, limit } = req.query;

  try {
    // Base query
    let query = supabase
      .from('feed_items')
      .select(
        `
        id,
        business_name,
        category,
        sub_category,
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
        scene,
        headline
      `,
        { count: 'exact' }
      )
      .eq('is_active', true)
      .eq('is_deleted', false);

    // City filter
    if (city) {
      query = query.ilike('city', `%${city}%`);
    }

    // Category filter
    if (category) {
      query = query.ilike('category', `%${category}%`);
    }

    // Text search across multiple columns
    if (q) {
      const search = q.trim();
      const pattern = `*${search}*`; // Supabase/PostgREST wildcard pattern

      // IMPORTANT:
      // - No extra "((" or "))"
      // - No functions like ARRAY_TO_STRING in this string
      // - Only column.operator.value segments separated by commas
      query = query.or(
        [
          `business_name.ilike.${pattern}`,
          `city.ilike.${pattern}`,
          `category.ilike.${pattern}`,
          `sub_category.ilike.${pattern}`
          // Do NOT do ilike on tags (text[]). If you want tags:
          // `tags.cs.{${search}}`  // requires exact match of tag
        ].join(',')
      );
    }

    // Price filter
    if (max_price) {
      const priceValue = Number(max_price);
      if (!Number.isNaN(priceValue)) {
        query = query.lte('price', priceValue);
      }
    }

    // Limit
    const pageSize = Math.min(parseInt(limit, 10) || 10, 50);
    query = query.limit(pageSize);

    // Execute
    const { data, error } = await query;

    if (error) {
      console.error('Supabase error in /search/businesses:', error);
      return res.status(500).json({ error: 'Failed to search businesses' });
    }

    res.json({ results: data || [] });
  } catch (err) {
    console.error('Unhandled error in /search/businesses:', err);
    res.status(500).json({ error: 'Failed to search businesses' });
  }
});

// Start server
app.listen(port, () => {
  console.log(`KonectFeed API running on port ${port}`);
});
