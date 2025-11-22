import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Load environment variables
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY");
}

// Supabase client (service role)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// -----------------------------
// SEARCH ENDPOINT
// -----------------------------
app.get("/search/businesses", async (req, res) => {
  try {
    const { q, city, limit = 10 } = req.query;

    let query = supabase
      .from("feed_items")
      .select("*")
      .limit(Number(limit));

    // Keyword search
    if (q) {
      query = query.textSearch("search_vector", q, {
        type: "websearch",
      });
    }

    // City filter
    if (city) {
      query = query.ilike("city", `%${city}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error("❌ Supabase search error:", error);
      return res.status(500).json({ error: "Failed to search businesses" });
    }

    return res.json({ results: data });
  } catch (err) {
    console.error("❌ Server error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// -----------------------------
// ROOT ENDPOINT
// -----------------------------
app.get("/", (req, res) => {
  res.send("KonectFeed API is running");
});

// -----------------------------
// START SERVER
// -----------------------------
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 KonectFeed API running on port ${PORT}`);
});
