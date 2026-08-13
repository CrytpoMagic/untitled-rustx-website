const { getSupabase, json } = require("./_supabase");

function toFrontend(r) {
  const out = { steamId:r.steam_id, name:r.name };
  const map = {
    clan_tag:"clanTag", kills:"kills", deaths:"deaths", headshots:"headshots",
    longest_kill_meters:"longestKillMeters", structures_destroyed:"structuresDestroyed",
    doors_destroyed:"doorsDestroyed", rockets_used:"rocketsUsed", c4_used:"c4Used",
    satchels_used:"satchelsUsed", explosive_ammo_used:"explosiveAmmoUsed",
    wood:"wood", stone:"stone", cloth:"cloth", metal_ore:"metalOre", sulfur_ore:"sulfurOre",
    hqm_ore:"hqmOre", scientists_killed:"scientistsKilled", animals_killed:"animalsKilled",
    bradley_kills:"bradleyKills", heli_kills:"heliKills", other_npc_kills:"otherNpcKills",
    playtime_seconds:"playtimeSeconds"
  };
  for (const [src,dst] of Object.entries(map)) if (r[src] !== null && r[src] !== undefined) out[dst] = r[src];
  return out;
}

exports.handler = async function(event) {
  if (event.httpMethod !== "GET") return json(405,{error:"Method not allowed"},{allow:"GET"});
  let supabase;
  try { supabase = getSupabase(); } catch (e) { return json(500, { error: e.message }); }
  const requested = event.queryStringParameters?.wipe || "current";
  let wipeId = requested;

  if (requested === "current") {
    const {data,error} = await supabase.from("leaderboard_wipes")
      .select("wipe_id,last_ingest_at").eq("is_current",true)
      .order("last_ingest_at",{ascending:false}).limit(1).maybeSingle();
    if (error) return json(500, { error: "Failed to resolve current wipe", detail: error.message });
    if (!data) return json(200,{wipeId:null,generatedAt:null,players:[]},{"access-control-allow-origin":"*"});
    wipeId = data.wipe_id;
  }

  const wipeQ = await supabase.from("leaderboard_wipes")
    .select("wipe_id,last_ingest_at").eq("wipe_id",wipeId).maybeSingle();
  if (wipeQ.error) return json(500,{error:"Failed to read wipe"});
  if (!wipeQ.data) return json(404,{error:"Wipe not found"});

  const statsQ = await supabase.from("leaderboard_player_stats")
    .select("*").eq("wipe_id",wipeId).order("kills",{ascending:false});
  if (statsQ.error) return json(500,{error:"Failed to read leaderboard"});

  return json(200,{
    wipeId,
    generatedAt:wipeQ.data.last_ingest_at,
    players:(statsQ.data || []).map(toFrontend)
  },{"access-control-allow-origin":"*"});
};
