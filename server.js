import express from "express";
import cors from "cors";
import morgan from "morgan";
import { createClient } from "@supabase/supabase-js";

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

// ====== ENVIRONMENT VARIABLES ======
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY");
}

// Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

// ====== SEARCH API ENDPOINT ======
app.get("/search/businesses", async (req, res) => {
  try {
    const { q, city, limit = 10 } = req.query;

    if (!q && !city) {
      return res.status(400).json({ error: "q or city is required" });
    }

    let query = supabase.from("feed_items")
      .select("*")
      .limit(Number(limit));

    // Text search (safe, simple)
    if (q) {
      query = query.or(
        `business_name.ilike.%${q}%,` +
        `category.ilike.%${q}%,` +
        `subcategory.ilike.%${q}%,` +
        `offer_title.ilike.%${q}%,` +
        `offer_description.ilike.%${q}%`
      );
    }

    // Filter by city
    if (city) {
      query = query.ilike("city", `%${city}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Supabase search error:", error);
      return res.status(500).json({ error: error.message });
    }

    res.json({ results: data || [] });

  } catch (e) {
    console.error("Server error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ====== ROOT TEST ======
app.get("/", (req, res) => {
  res.send("KonectFeed API is live");
});

// ====== START SERVER ======
const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`KonectFeed API running on port ${port}`);
});
