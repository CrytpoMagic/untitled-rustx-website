using Newtonsoft.Json;
using Oxide.Core;
using Oxide.Core.Plugins;
using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Threading.Tasks;

namespace Oxide.Plugins
{
    [Info("UntitledDailyWheel", "UntitledRustX", "1.0.0")]
    [Description("Delivers pending Daily Wheel rewards from the untitledrx.com backend.")]
    public class UntitledDailyWheel : RustPlugin
    {
        private static readonly HttpClient Http = new HttpClient();

        private class PluginConfigData
        {
            public string ApiBaseUrl = "https://untitledrx.com/.netlify/functions";
            public string PluginSecret = "CHANGE_ME_MATCH_WHEEL_PLUGIN_SECRET";
            public int PollSecondsOnlinePlayers = 60;
        }

        private PluginConfigData config;
        private readonly HashSet<string> deliveringNow = new HashSet<string>();

        protected override void LoadDefaultConfig()
        {
            config = new PluginConfigData();
            Config.WriteObject(config, true);
        }

        protected override void LoadConfig()
        {
            base.LoadConfig();
            try
            {
                config = Config.ReadObject<PluginConfigData>();
            }
            catch
            {
                PrintError("Config file invalid — regenerating defaults.");
                LoadDefaultConfig();
            }
            if (config == null) LoadDefaultConfig();
        }

        private void OnServerInitialized()
        {
            if (!Http.DefaultRequestHeaders.Contains("Authorization"))
            {
                Http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", config.PluginSecret);
            }
            timer.Every(config.PollSecondsOnlinePlayers, () =>
            {
                foreach (var player in BasePlayer.activePlayerList)
                {
                    CheckAndDeliver(player);
                }
            });
        }

        private void OnPlayerConnected(BasePlayer player)
        {
            timer.Once(5f, () => CheckAndDeliver(player));
        }

        private class WheelReward
        {
            public string id;
            public string prize_id;
            public string prize_name;
            public string kind;
            public string item_shortname;
            public int amount;
            public string command;
        }

        private class PendingResponse
        {
            public List<WheelReward> rewards;
        }

        private async void CheckAndDeliver(BasePlayer player)
        {
            if (player == null || !player.IsConnected) return;
            string steamId = player.UserIDString;
            if (deliveringNow.Contains(steamId)) return; // avoid overlapping polls for the same player
            deliveringNow.Add(steamId);

            try
            {
                string url = $"{config.ApiBaseUrl}/wheel-pending?steamid={steamId}";
                var res = await Http.GetAsync(url);
                if (!res.IsSuccessStatusCode)
                {
                    PrintWarning($"[UntitledDailyWheel] pending fetch failed ({(int)res.StatusCode}) for {steamId}");
                    return;
                }
                string body = await res.Content.ReadAsStringAsync();
                var parsed = JsonConvert.DeserializeObject<PendingResponse>(body);
                if (parsed?.rewards == null || parsed.rewards.Count == 0) return;

                foreach (var reward in parsed.rewards)
                {
                    // Re-check the player is still valid/connected each iteration — a long
                    // reward list shouldn't try to give items to someone who disconnected mid-loop.
                    if (player == null || !player.IsConnected) break;
                    GrantReward(player, reward);
                }
            }
            catch (Exception ex)
            {
                PrintError($"[UntitledDailyWheel] CheckAndDeliver error: {ex.Message}");
            }
            finally
            {
                deliveringNow.Remove(steamId);
            }
        }

        private async void GrantReward(BasePlayer player, WheelReward reward)
        {
            try
            {
                if (reward.kind == "command" && !string.IsNullOrEmpty(reward.command))
                {
                    // Store kits (teas, super serum, minicopter, resource kits, weapon kits) are
                    // delivered the same way a Tebex purchase is — via the existing kit/give
                    // console command already used elsewhere on the server, not raw ItemManager.
                    string cmd = reward.command.Replace("{steamid}", player.UserIDString);
                    ConsoleSystem.Run(ConsoleSystem.Option.Server, cmd);
                    player.ChatMessage($"Daily Wheel reward delivered: {reward.prize_name}");
                    await MarkDelivered(reward.id, player);
                    return;
                }

                var def = ItemManager.FindItemDefinition(reward.item_shortname);
                if (def == null)
                {
                    PrintError($"[UntitledDailyWheel] Unknown item shortname '{reward.item_shortname}' for reward {reward.id} — leaving pending, fix config server-side.");
                    return;
                }

                int amount = Math.Max(1, reward.amount);
                Item item = ItemManager.Create(def, amount);
                if (item == null) return;

                bool givenToInventory = player.inventory.GiveItem(item);
                if (!givenToInventory)
                {
                    // Inventory full: drop it at the player's feet instead of silently discarding
                    // the reward or leaving it pending forever behind a full-bag deadlock.
                    item.Drop(player.transform.position, Vector3.up * 0.2f);
                    player.ChatMessage($"Your Daily Wheel reward ({reward.prize_name}) was dropped near you — your inventory was full.");
                }
                else
                {
                    player.ChatMessage($"Daily Wheel reward delivered: {reward.prize_name}");
                }

                await MarkDelivered(reward.id, player);
            }
            catch (Exception ex)
            {
                PrintError($"[UntitledDailyWheel] GrantReward error for reward {reward.id}: {ex.Message}");
            }
        }

        private async Task MarkDelivered(string rewardId, BasePlayer player)
        {
            try
            {
                string url = $"{config.ApiBaseUrl}/wheel-delivered";
                var payload = JsonConvert.SerializeObject(new { rewardId });
                var content = new StringContent(payload, Encoding.UTF8, "application/json");
                var res = await Http.PostAsync(url, content);
                if (!res.IsSuccessStatusCode)
                {
                    PrintWarning($"[UntitledDailyWheel] mark-delivered failed ({(int)res.StatusCode}) for reward {rewardId} — will retry next poll (backend re-serves it while undelivered).");
                }
            }
            catch (Exception ex)
            {
                PrintError($"[UntitledDailyWheel] MarkDelivered error: {ex.Message}");
            }
        }
    }
}
