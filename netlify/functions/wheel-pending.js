const { getSupabase, json } = require("./_supabase");

// Plugin-only endpoint. Authenticates with a shared secret header — never a value the
// frontend ever sees. Returns undelivered rewards for one SteamID so the Rust plugin
// can grant them the moment that player is next online.
exports.handler = async function (event) {
  if (event.httpMethod !== "GET") return json(405, { error: "Method not allowed" });

  const auth = event.headers.authorization || event.headers.Authorization || "";
  const expected = process.env.WHEEL_PLUGIN_SECRET;
  if (!expected || auth !== `Bearer ${expected}`) return json(401, { error: "Unauthorized" });

  const steamId = (event.queryStringParameters || {}).steamid;
  if (!steamId || !/^\d{17}$/.test(steamId)) return json(400, { error: "Invalid steamid" });

  let supabase;
  try { supabase = getSupabase(); } catch (e) { return json(500, { error: e.message }); }

  const { data, error } = await supabase
    .from("wheel_spins")
    .select("id, prize_id, prize_name, kind, item_shortname, amount, command, created_at, delivery_attempts")
    .eq("steam_id", steamId)
    .eq("delivered", false)
    .order("created_at", { ascending: true });

  if (error) return json(500, { error: "Query failed", detail: error.message });

  return json(200, { rewards: data || [] });
};
