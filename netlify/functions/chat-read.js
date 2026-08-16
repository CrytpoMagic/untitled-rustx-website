const { getSupabase, json } = require("./_supabase");

exports.handler = async function (event) {
  if (event.httpMethod !== "GET") return json(405, { error: "Method not allowed" });
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("chat_messages")
      .select("sender, origin, message, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    return json(200, { messages: (data || []).reverse() });
  } catch (e) {
    return json(500, { error: "Chat read failed", detail: e.message });
  }
};
