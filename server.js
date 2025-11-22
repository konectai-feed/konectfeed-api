app.get('/search/businesses', async (req, res) => {
  try {
    const {
      q,               // search text (optional)
      city,            // city filter (optional)
      category,        // category filter, e.g. "Medspa" (optional)
      max_price,       // numeric price cap (optional)
      limit = 10       // default limit
    } = req.query;

    let query = supabase
      .from('feed_items')
      .select('*')
      .limit(Number(limit));

    // Filters
    if (city) {
      query = query.eq('city', city);
    }

    if (category) {
      query = query.eq('category', category);
    }

    if (max_price) {
      query = query.lte('price', max_price);
    }

    // Text search (only added if q is provided)
    if (q) {
      const search = `%${q}%`;

      // IMPORTANT: keep this as a single-line string (no newlines)
      query = query.or(
        `business_name.ilike.${search},` +
        `offer_title.ilike.${search},` +
        `offer_description.ilike.${search},` +
        `title.ilike.${search},` +
        `description.ilike.${search},` +
        `category.ilike.${search},` +
        `subcategory.ilike.${search},` +
        `city.ilike.${search},` +
        `ARRAY_TO_STRING(tags, ',').ilike.${search}`
      );
    }

    const { data, error } = await query;

    if (error) {
      console.error('Supabase error in /search/businesses:', error);
      return res.status(500).json({ error: 'Failed to search businesses' });
    }

    return res.json({ results: data || [] });
  } catch (err) {
    console.error('Unexpected error in /search/businesses:', err);
    return res.status(500).json({ error: 'Unexpected server error' });
  }
});
