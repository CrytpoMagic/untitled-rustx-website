const { getSupabase, json } = require("./_supabase");

// Admin-only manual ban. Auth: a shared secret you set as an env var, sent as a Bearer
// token — same pattern as LEADERBOARD_INGEST_SECRET, never exposed to the frontend.
exports.handler = async function (event) {
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });

  const auth = event.headers["authorization"] || event.headers["Authorization"] || "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!process.env.CHAT_ADMIN_SECRET || token !== process.env.CHAT_ADMIN_SECRET) {
    return json(401, { error: "Unauthorized" });
  }

  let body;
  try { body = JSON.parse(event.body || "{}"); } catch (e) { return json(400, { error: "Invalid JSON" }); }

  const { messageId, reason, durationHours } = body;
  if (!messageId) return json(400, { error: "messageId is required (from a chat message you want to ban the sender of)." });

  try {
    const supabase = getSupabase();

    // We don't store client_id on chat_messages (kept minimal/anonymous), so banning by
    // message alone isn't directly possible — ban by client_id instead, looked up from
    // a recent violation, OR pass clientId directly if you have it from logs.
    const clientId = body.clientId;
    if (!clientId) {
      return json(400, { error: "Pass clientId (from chat_violations table in Supabase, matched by timestamp) — messages don't store it." });
    }

    const bannedUntil = durationHours ? new Date(Date.now() + durationHours * 3600 * 1000).toISOString() : null;
    const { error } = await supabase.from("chat_bans").upsert({
      client_id: clientId,
      reason: reason || "manual ban",
      violation_count: 1,
      banned_at: new Date().toISOString(),
      banned_until: bannedUntil,
    });
    if (error) throw error;

    return json(200, { ok: true, clientId, bannedUntil: bannedUntil || "permanent" });
  } catch (e) {
    return json(500, { error: "Ban failed", detail: e.message });
  }
};
