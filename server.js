import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
});

app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'konectfeed-api' });
});

app.get('/search/businesses', async (req, res) => {
  try {
    const { q, city, category, min_price, max_price, limit = 5 } = req.query;

    if (!q || !city || !category) {
      return res.status(400).json({ error: 'q, city, category are required' });
    }

    let query = supabase
      .from('feed_items')
      .select(`
        id,
        business_name,
        category,
        subcategory,
        city,
        state,
        address,
        zip,
        min_price,
        max_price,
        rating,
        reviews_count,
        headline,
        description,
        scene,
        tags,
        offer_title,
        offer_description,
        price,
        buy_url,
        book_url,
        website,
        phone,
        image_url,
        gmb_url,
        fb_url,
        ig_url,
        is_sponsored,
        source,
        score
      `)
      .textSearch('search_vector', q, { type: 'plain' })
      .eq('city', city)
      .eq('category', category)
      .limit(Number(limit));

    if (min_price) query = query.gte('min_price', Number(min_price));
    if (max_price) query = query.lte('max_price', Number(max_price));

    const { data, error } = await query;

    if (error) return res.status(500).json({ error: error.message });

    res.json({ results: data ?? [] });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`KonectFeed API running on port ${PORT}`);
});
