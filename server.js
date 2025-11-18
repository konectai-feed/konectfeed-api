// server.js (ES module version)

import express from "express";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Env vars (Render provides these)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const PORT = process.env.PORT || 8080;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY.");
  process.exit(1);
}

// Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

// Health check
app.get("/", (req, res) => {
  res.json({ status: "ok", service: "konectfeed-api" });
});

/**
 * GET /search/businesses
 * Query params:
 *  - q           : text search
 *  - city        : city filter
 *  - category    : main category
 *  - subcategory : optional subtype
 *  - min_price   : minimum price
 *  - max_price   : maximum price
 *  - limit       : number of results (default 10)
 */
app.get("/search/businesses", async (req, res) => {
  try {
    const {
      q,
      city,
      category,
      subcategory,
      max_price,
      min_price,
      limit = 10,
    } = req.query;

    let query = supabase
      .from("feed_items")
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
        title,
        description,
        scene,
        headline,
        min_price,
        max_price,
        tags,
        score
        `
      );

    // Full-text search
    if (q) {
      query = query.textSearch("search_vector", q, { type: "websearch" });
    }

    // Filters
    if (city) query = query.ilike("city", city);
    if (category) query = query.ilike("category", category);
    if (subcategory) query = query.ilike("subcategory", subcategory);

    if (min_price) query = query.gte("price", Number(min_price));
    if (max_price) query = query.lte("price", Number(max_price));

    // Sort by score (you have this column already)
    query = query.order("score", { ascending: false });

    // Limit
    query = query.limit(Number(limit));

    const { data, error } = await query;

    if (error) {
      console.error("Supabase error:", error);
      return res.status(400).json({ error: error.message });
    }

    return res.json({ results: data });
  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`KonectFeed API running on port ${PORT}`);
});
