import express from "express";
import morgan from "morgan";
import cors from "cors";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

// ---- Supabase client ----
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error("SUPABASE_URL or SUPABASE_*_KEY is missing in environment");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ---- Middleware ----
app.use(cors());
app.use(morgan("dev"));
app.use(express.json());

// Health check
app.get("/", (req, res) => {
  res.json({ status: "ok", service: "konectfeed-api" });
});

/**
 * GET /search/businesses
 * Query params:
 *  - q: free-text search (optional)
 *  - city: city filter (optional)
 *  - category: category filter (optional)
 *  - max_price: max price filter (optional)
 *  - limit: number of results (default 10)
 */
app.get("/search/businesses", async (req, res) => {
  try {
    const { q, city, category, max_price, limit } = req.query;

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
        min_price,
        max_price,
        tags,
        is_sponsored,
        score
      `
      )
      // sponsored first, then highest score/rating
      .order("is_sponsored", { ascending: false })
      .order("score", { ascending: false })
      .order("rating", { ascending: false });

    // City filter
    if (city) {
      query = query.ilike("city", city);
    }

    // Category filter
    if (category) {
      query = query.ilike("category", category);
    }

    // Price cap
    if (max_price) {
      const cap = Number(max_price);
      if (!Number.isNaN(cap)) {
        query = query.lte("price", cap);
      }
    }

    // Text search across multiple fields
    if (q) {
      const pattern = `%${q}%`;

      // NOTE: use "subcategory" (no underscore) – this matches your actual column name.
      query = query.or(
        `
        business_name.ilike.${pattern},
        city.ilike.${pattern},
        category.ilike.${pattern},
        subcategory.ilike.${pattern},
        offer_title.ilike.${pattern},
        offer_description.ilike.${pattern},
        ARRAY_TO_STRING(tags, ',').ilike.${pattern}
      `
      );
    }

    // Limit
    const maxResults = limit ? parseInt(limit, 10) : 10;
    query = query.limit(Number.isNaN(maxResults) ? 10 : maxResults);

    const { data, error } = await query;

    if (error) {
      console.error("Supabase error in /search/businesses:", error);
      return res.status(500).json({ error: "Failed to search businesses" });
    }

    return res.json({ results: data || [] });
  } catch (err) {
    console.error("Unexpected error in /search/businesses:", err);
    return res.status(500).json({ error: "Failed to search businesses" });
  }
});

app.listen(PORT, () => {
  console.log(`KonectFeed API running on port ${PORT}`);
});
