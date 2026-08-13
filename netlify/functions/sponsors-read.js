const { getSupabase, json } = require("./_supabase");

exports.handler = async function (event) {
  if (event.httpMethod !== "GET") return json(405, { error: "Method not allowed" }, { allow: "GET" });

  let supabase;
  try { supabase = getSupabase(); } catch (e) { return json(500, { error: e.message }); }
  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .from("sponsors")
    .select("display_name, created_at")
    .eq("active", true)
    .gt("expires_at", nowIso)
    .order("created_at", { ascending: false });

  if (error) return json(500, { error: "Failed to read sponsors", detail: error.message });

  return json(200, { sponsors: (data || []).map(r => r.display_name) }, { "cache-control": "public, max-age=60" });
};
