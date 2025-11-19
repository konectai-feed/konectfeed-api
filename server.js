import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// -----------------------------
// HEALTH CHECK
// -----------------------------
app.get("/", (req, res) => {
  res.send({ status: "ok", service: "konectfeed-api" });
});

// -----------------------------
// SEARCH BUSINESSES
// -----------------------------
app.get("/search/businesses", async (req, res) => {
  try {
    const q = req.query.q || "";
    const city = req.query.city || "";
    const category = req.query.category || "";
    const max_price = req.query.max_price
      ? parseFloat(req.query.max_price)
      : null;
    const limit = req.query.limit ? parseInt(req.query.limit) : 10;

    let filters = [];

    if (city) filters.push(`city.eq.${city}`);
    if (category) filters.push(`category.eq.${category}`);
    if (max_price) filters.push(`price.lte.${max_price}`);

    const filterQuery = filters.join(",");

    const { data, error } = await supabase
      .from("feed_items")
      .select("*")
      .or(
        `business_name.ilike.%${q}%,` +
          `city.ilike.%${q}%,` +
          `category.ilike.%${q}%,` +
          `sub_category.ilike.%${q}%,` +
          `ARRAY_TO_STRING(tags, ',').ilike.%${q}%`
      )
      .filter(filterQuery !== "" ? filterQuery : undefined)
      .limit(limit);

    if (error) {
      console.error("Supabase error:", error);
      return res.status(400).json({ error: error.message });
    }

    res.json({ results: data });
  } catch (err) {
    console.error("API error:", err);
    res.status(500).json({ error: "Failed to search businesses" });
  }
});

// -----------------------------
const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`KonectFeed API running on port ${port}`));
