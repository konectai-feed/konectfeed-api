import express from "express";
import cors from "cors";
import morgan from "morgan";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

// --- Env checks ----------------------------------------------------
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error("SUPABASE_URL or SUPABASE_ANON_KEY is missing in environment");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// --- Express setup -------------------------------------------------
const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

// If you haven't installed morgan, either run `npm install morgan`
// or comment out the next line.
// Simple logging:
app.use(morgan("tiny"));

// --- Health check --------------------------------------------------
app.get("/", (req, res) => {
  res.json({ status: "ok", service: "konectfeed-api" });
});

// --- Search endpoint -----------------------------------------------
app.get("/search/businesses", async (req, res) => {
  try {
    const {
      q,            // search term (text)
      city,         // city filter
      category,     // category filter (medspa, accountant, etc.)
      max_price,    // numeric price ceiling
      limit         // max number of rows
    } = req.query;

    const parsedLimit = Math.min(parseInt(limit || "10", 10) || 10, 20);

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
        email,
        website,
        rating,
        reviews_count,
        price,
        min_price,
        max_price,
        offer_title,
        offer_description,
        image_url,
        buy_url,
        book_url,
        phone,
        tags,
        is_sponsored,
        score
      `
      )
      .limit(parsedLimit);

    // Basic filters (AND conditions)
    if (city) {
      query = query.eq("city", city);
    }

    if (category) {
      query = query.eq("category", category);
    }

    if (max_price) {
      const priceNumber = Number(max_price);
      if (!Number.isNaN(priceNumber)) {
        query = query.lte("price", priceNumber);
      }
    }

    // Text search across several columns
    if (q && q.trim() !== "") {
      const term = q.trim();

      // IMPORTANT: single-line string, no functions, no newlines
      const orConditions = [
        `business_name.ilike.%${term}%`,
        `city.ilike.%${term}%`,
        `category.ilike.%${term}%`,
        `subcategory.ilike.%${term}%`,
        `offer_title.ilike.%${term}%`,
        `offer_description.ilike.%${term}%`
      ].join(",");

      query = query.or(orConditions);
    }

    // Sort: sponsored first, then best score/price
    query = query
      .order("is_sponsored", { ascending: false, nullsFirst: false })
      .order("score", { ascending: false, nullsLast: true })
      .order("price", { ascending: true, nullsLast: true });

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

// --- Start server --------------------------------------------------
app.listen(PORT, () => {
  console.log(`KonectFeed API running on port ${PORT}`);
  console.log("Your service is live 🎉");
});
