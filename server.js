// ------------------------------------------------------
// KonectFeed API – Clean Full Version
// ------------------------------------------------------

import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { createClient } from '@supabase/supabase-js';

// ------------------------------------------------------
// ENV SETUP (Safe + Debug Logging)
// ------------------------------------------------------

const SUPABASE_URL = process.env.SUPABASE_URL?.trim() || '';
const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_KEY?.trim() ||
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
  '';

console.log("🔍 ENV CHECK → URL:", !!SUPABASE_URL, "SERVICE KEY:", !!SUPABASE_SERVICE_KEY);

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY");
}

// Connect Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ------------------------------------------------------
// Express Setup
// ------------------------------------------------------
const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// ------------------------------------------------------
// /search/businesses
// ------------------------------------------------------

/*
Example:
https://konectfeed-api.onrender.com/search/businesses?q=botox&city=Phoenix&limit=5
*/

app.get('/search/businesses', async (req, res) => {
  try {
    const q = req.query.q?.toLowerCase() ?? '';
    const city = req.query.city ?? '';
    const limit = parseInt(req.query.limit) || 10;

    if (!q && !city) {
      return res.status(400).json({ error: "Missing q or city parameter" });
    }

    console.log("🔎 SEARCH → q:", q, "city:", city, "limit:", limit);

    // ------------------------------------------------------
    // FULL-TEXT SEARCH using tsvector column "search_vector"
    // ------------------------------------------------------
    let query = supabase
      .from("feed_items")
      .select("*")
      .limit(limit);

    // Keyword search (tsvector)
    if (q) {
      query = query.textSearch("search_vector", q, {
        type: "websearch"
      });
    }

    // City filter (case-insensitive)
    if (city) {
      query = query.ilike("city", `%${city}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error("❌ Supabase search error:", error);
      return res.status(500).json({ error: "Failed to search businesses" });
    }

    // Format output
    const results = data.map(item => ({
      business_name: item.business_name,
      category: item.category,
