import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// ------------------------------------------------------
//   VALIDATE ENV
// ------------------------------------------------------
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing in environment");
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ------------------------------------------------------
//   SEARCH ENDPOINT
// ------------------------------------------------------
app.get("/search/businesses", async (req, res) => {
  try {
    const { q, city, category, subcategory, max_price, limit = 10 } = req.query;

    let query = supabase
      .from("feed_items")
      .select("*")
      .limit(Number(limit));

    // ------------------------------------------------------
    //   TEXT SEARCH (SAFE OR BLOCK)
    // ------------------------------------------------------
    if (q) {
      query = query.or(
        `business_name.ilike.%${q}%,` +
        `category.ilike.%${q}%,` +
        `subcategory.ilike.%${q}%,` +
        `offer_title.ilike.%${q}%,` +
        `offer_description.ilike.%${q}%,` +
        `city.ilike.%${q}%,` +
        `description.ilike.%${q}%`
      );
    }

    // ------------------------------------------------------
    //   CITY FILTER
    // ------------------------------------------------------
    if (city) {
      query = query.ilike("city", `%${city}%`);
    }

    // ------------------------------------------------------
    //   CATEGORY FILTER
    // ------------------------------------------------------
    if (category) {
      query = query.ilike("category", `%${category}%`);
    }

    // ------------------------------------------------------
    //   SUBCATEGORY FILTER
    // ------------------------------------------------------
    if (subcategory) {
      query = query.ilike("subcategory", `%${subcategory}%`);
    }

    // ------------------------------------------------------
    //   PRICE FILTER (this is text in your schema)
    //   If you want numeric sort later, convert column to numeric.
    // ------------------------------------------------------
    if (max_price) {
      query = query.lte("price", max_price);
    }

    // ------------------------------------------------------
    //   EXECUTE
    // ------------------------------------------------------
    const { data, error } = await query;

    if (error) {
      console.error("Supabase error:", error);
      return res.status(500).json({ error: "Database query failed" });
    }

    return res.json({ results: data || [] });

  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ------------------------------------------------------
//   ROOT
// ------------------------------------------------------
app.get("/", (req, res) => {
  res.send("KonectFeed API is running.");
});

// ------------------------------------------------------
//   SERVER
// ------------------------------------------------------
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`KonectFeed API running on port ${PORT}`);
});
