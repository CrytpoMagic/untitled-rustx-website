const { getSupabase, json } = require("./_supabase");

exports.handler = async function(event) {
  if (event.httpMethod !== "GET") {
    return json(405, { error: "Method not allowed" }, { allow: "GET" });
  }

  let supabase;
  try { supabase = getSupabase(); } catch (e) { return json(500, { error: e.message }); }
  const params = event.queryStringParameters || {};
  const requested = params.wipe || "current";
  const category = String(params.category || "").toLowerCase();
  const subtype = String(params.subtype || "").toLowerCase();

  if (!category || !subtype) {
    return json(400, { error: "category and subtype are required" });
  }

  let wipeId = requested;

  if (requested === "current") {
    const q = await supabase.from("leaderboard_wipes")
      .select("wipe_id")
      .eq("is_current", true)
      .order("last_ingest_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (q.error) return json(500, { error: "Failed to resolve current wipe" });
    if (!q.data) return json(200, { wipeId: null, category, subtype, cells: [] }, {"access-control-allow-origin":"*"});
    wipeId = q.data.wipe_id;
  }

  const q = await supabase.from("leaderboard_heatmap_cells")
    .select("cell_x,cell_y,event_count,generated_at")
    .eq("wipe_id", wipeId)
    .eq("category", category)
    .eq("subtype", subtype)
    .order("event_count", { ascending: false });

  if (q.error) return json(500, { error: "Failed to read heatmap" });

  return json(200, {
    wipeId,
    category,
    subtype,
    cellSizeMeters: 150,
    cells: (q.data || []).map(r => ({
      cellX: r.cell_x,
      cellY: r.cell_y,
      count: r.event_count
    }))
  }, {"access-control-allow-origin":"*"});
};
