const { getSupabase, json } = require("./_supabase");

const ALLOWED_CATEGORIES = new Set(["pvp","raiding","farming","pve"]);
const ALLOWED_SUBTYPES = new Set([
  "kills","deaths",
  "rockets","c4","satchels",
  "wood","stone","cloth","metal","sulfur",
  "scientists","animals","bradley","heli"
]);

exports.handler = async function(event) {
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed" }, { allow: "POST" });
  }

  const expected = process.env.LEADERBOARD_INGEST_SECRET;
  const auth = event.headers.authorization || event.headers.Authorization || "";
  if (!expected) return json(500, { error: "Missing LEADERBOARD_INGEST_SECRET" });
  if (auth !== `Bearer ${expected}`) return json(401, { error: "Unauthorized" });

  let payload;
  try { payload = JSON.parse(event.body || "{}"); }
  catch { return json(400, { error: "Invalid JSON" }); }

  const wipeId = String(payload.wipeId || "").trim();
  const category = String(payload.category || "").toLowerCase();
  const subtype = String(payload.subtype || "").toLowerCase();
  const generatedAt = payload.generatedAt || new Date().toISOString();
  const cells = Array.isArray(payload.cells) ? payload.cells : null;

  if (!wipeId || !ALLOWED_CATEGORIES.has(category) || !ALLOWED_SUBTYPES.has(subtype) || !cells) {
    return json(400, { error: "Invalid wipeId/category/subtype/cells" });
  }

  if (cells.length > 10000) return json(413, { error: "Too many cells" });

  // Privacy floor: never store cells with fewer than 3 events.
  const rows = cells
    .filter(c => Number.isInteger(c.cellX) && Number.isInteger(c.cellY) && Number.isFinite(c.count) && c.count >= 3)
    .map(c => ({
      wipe_id: wipeId,
      category,
      subtype,
      cell_x: c.cellX,
      cell_y: c.cellY,
      event_count: Math.floor(c.count),
      generated_at: generatedAt,
      updated_at: generatedAt
    }));

  let supabase;
  try { supabase = getSupabase(); } catch (e) { return json(500, { error: e.message }); }

  // Ensure wipe exists; do not toggle current here because stats ingest owns current-wipe state.
  const wipeQ = await supabase.from("leaderboard_wipes").upsert(
    { wipe_id: wipeId, last_ingest_at: generatedAt },
    { onConflict: "wipe_id" }
  );
  if (wipeQ.error) return json(500, { error: "Failed to upsert wipe", detail: wipeQ.error.message });

  // Snapshot semantics: replace this category/subtype for the wipe with the latest aggregate.
  const delQ = await supabase.from("leaderboard_heatmap_cells")
    .delete()
    .eq("wipe_id", wipeId)
    .eq("category", category)
    .eq("subtype", subtype);

  if (delQ.error) return json(500, { error: "Failed to replace old heatmap snapshot", detail: delQ.error.message });

  if (rows.length) {
    const upQ = await supabase.from("leaderboard_heatmap_cells").upsert(
      rows,
      { onConflict: "wipe_id,category,subtype,cell_x,cell_y" }
    );
    if (upQ.error) return json(500, { error: "Failed to write heatmap cells", detail: upQ.error.message });
  }

  return json(200, {
    ok: true,
    wipeId,
    category,
    subtype,
    acceptedCells: rows.length,
    generatedAt
  });
};
