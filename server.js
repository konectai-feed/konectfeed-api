// SEARCH BUSINESSES ENDPOINT
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

    let query = supabase.from("feed_items").select(
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
      query = query.textSearch("search_vector", q, {
        type: "websearch",
      });
    }

    // Filters
    if (city) query = query.ilike("city", city);
    if (category) query = query.ilike("category", category);
    if (subcategory) query = query.ilike("subcategory", subcategory);

    if (min_price) query = query.gte("price", Number(min_price));
    if (max_price) query = query.lte("price", Number(max_price));

    // Order by score (remove is_sponsored)
    query = query.order("score", { ascending: false });

    // Limit
    query = query.limit(Number(limit));

    const { data, error } = await query;

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.json({ results: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
