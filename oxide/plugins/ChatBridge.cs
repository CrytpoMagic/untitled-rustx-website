using Newtonsoft.Json;
using Oxide.Core;
using Oxide.Core.Plugins;
using System;
using System.Collections.Generic;
using System.Net;
using System.Text;
using UnityEngine;

namespace Oxide.Plugins
{
    [Info("ChatBridge", "UntitledRustX", "1.0.0")]
    [Description("Bridges in-game chat with the untitledrx.com website chat widget.")]
    public class ChatBridge : RustPlugin
    {
        private Configuration _config;
        private string _lastPolledAt = "";

        protected override void LoadDefaultConfig() => _config = new Configuration();

        protected override void LoadConfig()
        {
            base.LoadConfig();
            try { _config = Config.ReadObject<Configuration>(); } catch { _config = new Configuration(); }
            SaveConfig();
        }

        protected override void SaveConfig() => Config.WriteObject(_config, true);

        private class Configuration
        {
            public string IngestUrl = "https://untitledrx.com/api/chat/game-ingest";
            public string ReadUrl = "https://untitledrx.com/api/chat/read";
            public string BearerSecret = "CHANGE_ME";
            public float PollIntervalSeconds = 5f;
        }

        void Init()
        {
            _lastPolledAt = DateTime.UtcNow.ToString("o");
            timer.Every(_config.PollIntervalSeconds, PollWebsiteChat);
        }

        // In-game chat -> website
        object OnPlayerChat(BasePlayer player, string message, ConVar.Chat.ChatChannel channel)
        {
            if (player == null || string.IsNullOrEmpty(message)) return null;
            if (channel != ConVar.Chat.ChatChannel.Global) return null;
            PushToWebsite(player.displayName, message);
            return null;
        }

        void PushToWebsite(string sender, string message)
        {
            var payload = new Dictionary<string, object> { { "sender", sender }, { "message", message } };
            var json = JsonConvert.SerializeObject(payload);
            var headers = new Dictionary<string, string> { { "Authorization", "Bearer " + _config.BearerSecret }, { "Content-Type", "application/json" } };
            webrequest.Enqueue(_config.IngestUrl, json, (code, response) => { }, this, Oxide.Core.Libraries.RequestMethod.POST, headers, 10f);
        }

        // Website -> in-game chat
        void PollWebsiteChat()
        {
            webrequest.Enqueue(_config.ReadUrl, null, (code, response) =>
            {
                if (code != 200 || string.IsNullOrEmpty(response)) { if (code != 200) PrintWarning($"[ChatBridge] Poll failed ({code})"); return; }
                try
                {
                    var data = JsonConvert.DeserializeObject<ReadResponse>(response);
                    if (data?.messages == null) return;
                    string maxAt = _lastPolledAt;
                    foreach (var m in data.messages)
                    {
                        if (m.origin != "website") continue;
                        if (string.IsNullOrEmpty(m.created_at)) continue;
                        if (string.Compare(m.created_at, _lastPolledAt, StringComparison.Ordinal) <= 0) continue;
                        if (string.Compare(m.created_at, maxAt, StringComparison.Ordinal) > 0) maxAt = m.created_at;
                        Server.Broadcast($"<color=#ff8a52>Website Viewer</color>: {m.message}");
                    }
                    _lastPolledAt = maxAt;
                }
                catch (Exception ex) { PrintWarning($"[ChatBridge] Parse error: {ex.Message}"); }
            }, this, Oxide.Core.Libraries.RequestMethod.GET, null, 10f);
        }

        private class ChatMsg
        {
            public long id;
            public string sender;
            public string origin;
            public string message;
            public string created_at;
        }

        private class ReadResponse
        {
            public List<ChatMsg> messages;
        }
    }
}
