const { getSupabase, json } = require("./_supabase");

// Plugin-only endpoint, same shared-secret auth as wheel-pending. Marking delivered is
// idempotent: re-marking an already-delivered reward id is a harmless no-op, so a
// plugin reload or a duplicated API response can never grant an item twice.
exports.handler = async function (event) {
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });

  const auth = event.headers.authorization || event.headers.Authorization || "";
  const expected = process.env.WHEEL_PLUGIN_SECRET;
  if (!expected || auth !== `Bearer ${expected}`) return json(401, { error: "Unauthorized" });

  let body;
  try { body = JSON.parse(event.body || "{}"); } catch (e) { return json(400, { error: "Invalid JSON" }); }
  const rewardId = body.rewardId;
  if (!rewardId) return json(400, { error: "rewardId required" });

  let supabase;
  try { supabase = getSupabase(); } catch (e) { return json(500, { error: e.message }); }

  const { data: existing } = await supabase.from("wheel_spins").select("delivered").eq("id", rewardId).maybeSingle();
  if (!existing) return json(404, { error: "Reward not found" });
  if (existing.delivered) return json(200, { ok: true, alreadyDelivered: true });

  const { error } = await supabase
    .from("wheel_spins")
    .update({ delivered: true, delivered_at: new Date().toISOString() })
    .eq("id", rewardId)
    .eq("delivered", false);

  if (error) {
    return json(500, { error: "Failed to mark delivered", detail: error.message });
  }

  return json(200, { ok: true });
};
