const { getSupabase, json } = require("./_supabase");

// Called by the Rust plugin to push a live in-game chat line to the website.
exports.handler = async function (event) {
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });

  const auth = event.headers.authorization || event.headers.Authorization || "";
  const expected = "Bearer " + (process.env.CHAT_INGEST_SECRET || "");
  if (!process.env.CHAT_INGEST_SECRET || auth !== expected) return json(401, { error: "Unauthorized" });

  let body;
  try { body = JSON.parse(event.body || "{}"); } catch (e) { return json(400, { error: "Invalid JSON" }); }

  const sender = String(body.sender || "Player").slice(0, 40);
  const message = String(body.message || "").slice(0, 300);
  if (!message) return json(400, { error: "Missing message" });

  try {
    const supabase = getSupabase();
    const { error } = await supabase.from("chat_messages").insert({ sender, origin: "game", message });
    if (error) throw error;
    return json(200, { ok: true });
  } catch (e) {
    return json(500, { error: "Ingest failed", detail: e.message });
  }
};
