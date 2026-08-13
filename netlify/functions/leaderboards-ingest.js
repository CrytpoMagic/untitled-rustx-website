const { getSupabase, json } = require("./_supabase");

function mapPlayer(input, wipeId, generatedAt) {
  const out = { wipe_id: wipeId, steam_id: String(input.steamId || ""), generated_at: generatedAt };
  const map = {
    name:"name", clanTag:"clan_tag", kills:"kills", deaths:"deaths", headshots:"headshots",
    longestKillMeters:"longest_kill_meters", structuresDestroyed:"structures_destroyed",
    doorsDestroyed:"doors_destroyed", rocketsUsed:"rockets_used", c4Used:"c4_used",
    satchelsUsed:"satchels_used", explosiveAmmoUsed:"explosive_ammo_used",
    wood:"wood", stone:"stone", cloth:"cloth", metalOre:"metal_ore", sulfurOre:"sulfur_ore",
    hqmOre:"hqm_ore", scientistsKilled:"scientists_killed", animalsKilled:"animals_killed",
    bradleyKills:"bradley_kills", heliKills:"heli_kills", otherNpcKills:"other_npc_kills",
    playtimeSeconds:"playtime_seconds"
  };
  for (const [src,dst] of Object.entries(map)) {
    if (Object.prototype.hasOwnProperty.call(input, src)) out[dst] = input[src];
  }
  return out;
}

exports.handler = async function(event) {
  if (event.httpMethod !== "POST") return json(405,{error:"Method not allowed"},{allow:"POST"});
  const expected = process.env.LEADERBOARD_INGEST_SECRET;
  const auth = event.headers.authorization || event.headers.Authorization || "";
  if (!expected) return json(500,{error:"Missing LEADERBOARD_INGEST_SECRET"});
  if (auth !== `Bearer ${expected}`) return json(401,{error:"Unauthorized"});

  let payload;
  try { payload = JSON.parse(event.body || "{}"); } catch { return json(400,{error:"Invalid JSON"}); }

  const wipeId = String(payload.wipeId || "").trim();
  const generatedAt = payload.generatedAt || new Date().toISOString();
  const players = Array.isArray(payload.players) ? payload.players : null;
  if (!wipeId || !players) return json(400,{error:"wipeId and players[] are required"});
  if (players.length > 2000) return json(413,{error:"Too many players"});

  const rows = players
    .filter(p => p && p.steamId && p.name && /^\d{17}$/.test(String(p.steamId)))
    .map(p => mapPlayer(p, wipeId, generatedAt));

  let supabase;
  try { supabase = getSupabase(); } catch (e) { return json(500, { error: e.message }); }

  let q = await supabase.from("leaderboard_wipes")
    .update({is_current:false}).neq("wipe_id",wipeId).eq("is_current",true);
  if (q.error) return json(500,{error:"Failed to archive previous wipe",detail:q.error.message});

  q = await supabase.from("leaderboard_wipes").upsert(
    {wipe_id:wipeId,is_current:true,last_ingest_at:generatedAt},
    {onConflict:"wipe_id"}
  );
  if (q.error) return json(500,{error:"Failed to upsert wipe",detail:q.error.message});

  if (rows.length) {
    q = await supabase.from("leaderboard_player_stats").upsert(rows,{onConflict:"wipe_id,steam_id"});
    if (q.error) return json(500,{error:"Failed to upsert player stats",detail:q.error.message});
  }

  return json(200,{ok:true,wipeId,received:players.length,accepted:rows.length,generatedAt});
};
