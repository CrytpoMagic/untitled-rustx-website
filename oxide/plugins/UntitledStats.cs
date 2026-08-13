using System;
using System.Collections.Generic;
using System.Linq;
using Newtonsoft.Json;
using Oxide.Core;
using Oxide.Core.Libraries;
using UnityEngine;

namespace Oxide.Plugins
{
    [Info("UntitledStats", "OpenAI", "1.1.0")]
    [Description("Collects UNTITLED RUSTX wipe stats and pushes them to the leaderboard API.")]
    public class UntitledStats : RustPlugin
    {
        private const string PermAdmin = "untitledstats.admin";

        private ConfigData _config;
        private StoredData _data;
        private Timer _pushTimer;
        private Timer _playtimeTimer;
        private readonly Dictionary<ulong, double> _connectedSince = new Dictionary<ulong, double>();

        private class ConfigData
        {
            [JsonProperty("Ingest URL")]
            public string IngestUrl = "https://untitledrx.com/api/leaderboards/ingest";

            [JsonProperty("Bearer Secret")]
            public string BearerSecret = "CHANGE_ME";

            [JsonProperty("Push Interval Seconds")]
            public float PushIntervalSeconds = 600f;

            [JsonProperty("Heatmap Ingest URL")]
            public string HeatmapIngestUrl = "https://untitledrx.com/api/leaderboards/heatmap-ingest";

            [JsonProperty("Heatmap Cell Size Meters")]
            public float HeatmapCellSizeMeters = 150f;

            [JsonProperty("Heatmap Minimum Events Per Cell")]
            public int HeatmapMinimumEventsPerCell = 3;
        }

        private class StoredData
        {
            public string WipeId;
            public string WipeStartedAtUtc;
            public Dictionary<ulong, PlayerStats> Players = new Dictionary<ulong, PlayerStats>();
            public Dictionary<string, Dictionary<string, int>> Heatmap = new Dictionary<string, Dictionary<string, int>>();
        }

        private class PlayerStats
        {
            [JsonProperty("steamId")] public string SteamId;
            [JsonProperty("name")] public string Name;
            [JsonProperty("clanTag", NullValueHandling = NullValueHandling.Ignore)] public string ClanTag;

            [JsonProperty("kills")] public int Kills;
            [JsonProperty("deaths")] public int Deaths;
            [JsonProperty("headshots")] public int Headshots;
            [JsonProperty("longestKillMeters")] public int LongestKillMeters;

            [JsonProperty("structuresDestroyed")] public int StructuresDestroyed;
            [JsonProperty("doorsDestroyed")] public int DoorsDestroyed;
            [JsonProperty("rocketsUsed")] public int RocketsUsed;
            [JsonProperty("c4Used")] public int C4Used;
            [JsonProperty("satchelsUsed")] public int SatchelsUsed;
            [JsonProperty("explosiveAmmoUsed")] public int ExplosiveAmmoUsed;

            [JsonProperty("wood")] public int Wood;
            [JsonProperty("stone")] public int Stone;
            [JsonProperty("cloth")] public int Cloth;
            [JsonProperty("metalOre")] public int MetalOre;
            [JsonProperty("sulfurOre")] public int SulfurOre;
            [JsonProperty("hqmOre")] public int HqmOre;

            [JsonProperty("scientistsKilled")] public int ScientistsKilled;
            [JsonProperty("animalsKilled")] public int AnimalsKilled;
            [JsonProperty("bradleyKills")] public int BradleyKills;
            [JsonProperty("heliKills")] public int HeliKills;
            [JsonProperty("otherNpcKills")] public int OtherNpcKills;
            [JsonProperty("playtimeSeconds")] public int PlaytimeSeconds;
        }

        private class HeatmapCell
        {
            public int cellX;
            public int cellY;
            public int count;
        }

        private class HeatmapPayload
        {
            public string wipeId;
            public string generatedAt;
            public string category;
            public string subtype;
            public List<HeatmapCell> cells;
        }

        private class Payload
        {
            public string wipeId;
            public string generatedAt;
            public List<PlayerStats> players;
        }

        protected override void LoadDefaultConfig()
        {
            _config = new ConfigData();
            SaveConfig();
        }

        private void Init()
        {
            try { _config = Config.ReadObject<ConfigData>() ?? new ConfigData(); }
            catch { _config = new ConfigData(); }
            SaveConfig();

            permission.RegisterPermission(PermAdmin, this);
            LoadData();
            EnsureWipe();
        }

        private void OnServerInitialized()
        {
            foreach (var player in BasePlayer.activePlayerList)
            {
                Touch(player);
                _connectedSince[player.userID] = Time.realtimeSinceStartup;
            }

            _pushTimer = timer.Every(Mathf.Max(60f, _config.PushIntervalSeconds), Push);
            _playtimeTimer = timer.Every(60f, FlushPlaytime);
        }

        private void Unload()
        {
            FlushPlaytime();
            SaveData();
            _pushTimer?.Destroy();
            _playtimeTimer?.Destroy();
        }

        private void OnServerSave() => SaveData();

        private void OnNewSave(string filename)
        {
            _data = new StoredData();
            _data.WipeStartedAtUtc = DateTime.UtcNow.ToString("o");
            _data.WipeId = BuildWipeId();
            SaveData();
            Puts("Leaderboard wipe reset: " + _data.WipeId);
        }

        private void OnPlayerConnected(BasePlayer player)
        {
            Touch(player);
            _connectedSince[player.userID] = Time.realtimeSinceStartup;
        }

        private void OnPlayerDisconnected(BasePlayer player, string reason)
        {
            FlushPlayerPlaytime(player.userID);
            SaveData();
        }

        private void OnPlayerDeath(BasePlayer victim, HitInfo info)
        {
            if (victim == null) return;

            Touch(victim).Deaths++;
            RecordHeat("pvp", "deaths", victim.transform.position, 1);

            var attacker = info?.InitiatorPlayer;
            if (attacker == null || attacker == victim) return;

            var s = Touch(attacker);
            s.Kills++;
            RecordHeat("pvp", "kills", victim.transform.position, 1);

            int meters = Mathf.RoundToInt(Vector3.Distance(attacker.transform.position, victim.transform.position));
            if (meters > s.LongestKillMeters) s.LongestKillMeters = meters;

            try
            {
                if (info != null && info.isHeadshot) s.Headshots++;
            }
            catch { }
        }

        private void OnDispenserGather(ResourceDispenser dispenser, BasePlayer player, Item item)
        {
            if (player != null && item != null) AddGather(player,item.info?.shortname,item.amount);
        }

        private void OnDispenserBonus(ResourceDispenser dispenser, BasePlayer player, Item item)
        {
            if (player != null && item != null) AddGather(player,item.info?.shortname,item.amount);
        }

        private void OnCollectiblePickup(Item item, BasePlayer player)
        {
            if (player != null && item != null) AddGather(player,item.info?.shortname,item.amount);
        }

        private void OnRocketLaunched(BasePlayer player, BaseEntity entity)
        {
            if (player != null) { Touch(player).RocketsUsed++; RecordHeat("raiding","rockets",player.transform.position,1); }
        }

        private void OnExplosiveThrown(BasePlayer player, BaseEntity entity)
        {
            if (player == null || entity == null) return;
            string n = ((entity.ShortPrefabName ?? "") + " " + (entity.PrefabName ?? "")).ToLowerInvariant();
            var s = Touch(player);
            if (n.Contains("explosive.timed") || n.Contains("c4")) { s.C4Used++; RecordHeat("raiding","c4",player.transform.position,1); }
            else if (n.Contains("satchel")) { s.SatchelsUsed++; RecordHeat("raiding","satchels",player.transform.position,1); }
        }

        private void OnWeaponFired(BaseProjectile projectile, BasePlayer player)
        {
            if (projectile == null || player == null) return;
            try
            {
                string ammo = projectile.primaryMagazine?.ammoType?.shortname ?? "";
                if (ammo.Equals("ammo.rifle.explosive", StringComparison.OrdinalIgnoreCase))
                    Touch(player).ExplosiveAmmoUsed++;
            }
            catch { }
        }

        private void OnEntityDeath(BaseCombatEntity entity, HitInfo info)
        {
            if (entity == null) return;
            var attacker = info?.InitiatorPlayer;
            if (attacker == null || entity is BasePlayer) return;

            var s = Touch(attacker);

            if (entity is BuildingBlock) s.StructuresDestroyed++;
            else if (entity is Door) s.DoorsDestroyed++;

            string combined = ((entity.GetType().Name ?? "") + " " +
                               (entity.ShortPrefabName ?? "") + " " +
                               (entity.PrefabName ?? "")).ToLowerInvariant();

            if (combined.Contains("bradley")) { s.BradleyKills++; RecordHeat("pve","bradley",entity.transform.position,1); }
            else if (combined.Contains("patrolhelicopter") || combined.Contains("patrol_helicopter")) { s.HeliKills++; RecordHeat("pve","heli",entity.transform.position,1); }
            else if (combined.Contains("scientist")) { s.ScientistsKilled++; RecordHeat("pve","scientists",entity.transform.position,1); }
            else if (combined.Contains("bear") || combined.Contains("wolf") || combined.Contains("boar") ||
                     combined.Contains("stag") || combined.Contains("chicken") || combined.Contains("horse")) s.AnimalsKilled++; RecordHeat("pve","animals",entity.transform.position,1);
            else if (combined.Contains("npc") || combined.Contains("murderer") || combined.Contains("dweller")) s.OtherNpcKills++;
        }

        [ChatCommand("ustats")]
        private void UStats(BasePlayer player, string command, string[] args)
        {
            if (!permission.UserHasPermission(player.UserIDString, PermAdmin))
            {
                player.ChatMessage("<color=#F26A20>[UNTITLED STATS]</color> No permission.");
                return;
            }

            if (args.Length == 0)
            {
                player.ChatMessage("/ustats status | /ustats push | /ustats resetwipe");
                return;
            }

            switch (args[0].ToLowerInvariant())
            {
                case "status":
                    player.ChatMessage($"Wipe: {_data.WipeId}\nPlayers: {_data.Players.Count}\nEndpoint: {_config.IngestUrl}");
                    break;
                case "push":
                    Push();
                    player.ChatMessage("Leaderboard push started.");
                    break;
                case "resetwipe":
                    _data = new StoredData { WipeStartedAtUtc = DateTime.UtcNow.ToString("o") };
                    _data.WipeId = BuildWipeId();
                    SaveData();
                    player.ChatMessage("Stats reset. New wipe: " + _data.WipeId);
                    break;
            }
        }

        private PlayerStats Touch(BasePlayer p)
        {
            PlayerStats s;
            if (!_data.Players.TryGetValue(p.userID,out s))
            {
                s = new PlayerStats { SteamId=p.UserIDString, Name=p.displayName };
                _data.Players[p.userID] = s;
            }
            else s.Name = p.displayName;
            return s;
        }

        private void AddGather(BasePlayer p, string shortName, int amount)
        {
            if (string.IsNullOrEmpty(shortName) || amount <= 0) return;
            var s = Touch(p);
            switch (shortName.ToLowerInvariant())
            {
                case "wood": s.Wood += amount; RecordHeat("farming","wood",p.transform.position,amount); break;
                case "stones":
                case "stone": s.Stone += amount; RecordHeat("farming","stone",p.transform.position,amount); break;
                case "cloth": s.Cloth += amount; RecordHeat("farming","cloth",p.transform.position,amount); break;
                case "metal.ore": s.MetalOre += amount; RecordHeat("farming","metal",p.transform.position,amount); break;
                case "sulfur.ore": s.SulfurOre += amount; RecordHeat("farming","sulfur",p.transform.position,amount); break;
                case "hq.metal.ore": s.HqmOre += amount; break;
            }
        }

        private void FlushPlaytime()
        {
            foreach (var p in BasePlayer.activePlayerList) FlushPlayerPlaytime(p.userID);
        }

        private void FlushPlayerPlaytime(ulong id)
        {
            double since;
            if (!_connectedSince.TryGetValue(id,out since)) return;
            int elapsed = Mathf.Max(0, Mathf.RoundToInt((float)(Time.realtimeSinceStartup - since)));
            PlayerStats s;
            if (_data.Players.TryGetValue(id,out s)) s.PlaytimeSeconds += elapsed;
            _connectedSince[id] = Time.realtimeSinceStartup;
        }

        private void Push()
        {
            if (string.IsNullOrWhiteSpace(_config.BearerSecret) || _config.BearerSecret == "CHANGE_ME")
            {
                PrintWarning("Configure Bearer Secret in oxide/config/UntitledStats.json first.");
                return;
            }

            FlushPlaytime();

            string body = JsonConvert.SerializeObject(new Payload {
                wipeId = _data.WipeId,
                generatedAt = DateTime.UtcNow.ToString("o"),
                players = _data.Players.Values.ToList()
            }, new JsonSerializerSettings {
                NullValueHandling = NullValueHandling.Ignore,
                DefaultValueHandling = DefaultValueHandling.Ignore
            });

            var headers = new Dictionary<string,string> {
                ["Authorization"] = "Bearer " + _config.BearerSecret,
                ["Content-Type"] = "application/json"
            };

            webrequest.Enqueue(_config.IngestUrl, body, (code,response) => {
                if (code >= 200 && code < 300)
                    Puts($"Leaderboard push OK ({code}). Players={_data.Players.Count}");
                else
                    PrintWarning($"Leaderboard push failed ({code}): {response}");
            }, this, RequestMethod.POST, headers);

            PushHeatmaps(headers);
        }

        private void RecordHeat(string category, string subtype, Vector3 position, int amount)
        {
            if (amount <= 0) return;

            float cell = Mathf.Max(150f, _config.HeatmapCellSizeMeters);
            int cellX = Mathf.FloorToInt(position.x / cell);
            int cellY = Mathf.FloorToInt(position.z / cell);

            string bucket = category + "|" + subtype;
            Dictionary<string, int> cells;
            if (!_data.Heatmap.TryGetValue(bucket, out cells))
            {
                cells = new Dictionary<string, int>();
                _data.Heatmap[bucket] = cells;
            }

            string key = cellX + "," + cellY;
            int existing;
            cells.TryGetValue(key, out existing);
            cells[key] = existing + amount;
        }

        private void PushHeatmaps(Dictionary<string,string> headers)
        {
            if (string.IsNullOrWhiteSpace(_config.HeatmapIngestUrl) || _data.Heatmap == null)
                return;

            foreach (var bucket in _data.Heatmap)
            {
                string[] parts = bucket.Key.Split('|');
                if (parts.Length != 2) continue;

                var cells = new List<HeatmapCell>();

                foreach (var kvp in bucket.Value)
                {
                    if (kvp.Value < Mathf.Max(3, _config.HeatmapMinimumEventsPerCell))
                        continue;

                    string[] xy = kvp.Key.Split(',');
                    int x, y;
                    if (xy.Length != 2 || !int.TryParse(xy[0], out x) || !int.TryParse(xy[1], out y))
                        continue;

                    cells.Add(new HeatmapCell { cellX = x, cellY = y, count = kvp.Value });
                }

                var payload = new HeatmapPayload {
                    wipeId = _data.WipeId,
                    generatedAt = DateTime.UtcNow.ToString("o"),
                    category = parts[0],
                    subtype = parts[1],
                    cells = cells
                };

                string body = JsonConvert.SerializeObject(payload);

                webrequest.Enqueue(_config.HeatmapIngestUrl, body, (code,response) => {
                    if (code < 200 || code >= 300)
                        PrintWarning($"Heatmap push failed ({code}): {response}");
                }, this, RequestMethod.POST, headers);
            }
        }

        private void EnsureWipe()
        {
            if (string.IsNullOrEmpty(_data.WipeStartedAtUtc)) _data.WipeStartedAtUtc = DateTime.UtcNow.ToString("o");
            if (string.IsNullOrEmpty(_data.WipeId)) _data.WipeId = BuildWipeId();
            SaveData();
        }

        private string BuildWipeId()
        {
            int seed = 0;
            try { seed = World.Seed; } catch { }
            return $"map_{seed}_{_data.WipeStartedAtUtc}";
        }

        private void LoadData()
        {
            try { _data = Interface.Oxide.DataFileSystem.ReadObject<StoredData>(Name) ?? new StoredData(); }
            catch { _data = new StoredData(); }
        }

        private void SaveData()
        {
            Interface.Oxide.DataFileSystem.WriteObject(Name,_data);
        }
    }
}
