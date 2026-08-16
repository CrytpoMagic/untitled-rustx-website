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
        private long _lastPolledId = 0;

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
            timer.Every(_config.PollIntervalSeconds, PollWebsiteChat);
        }

        // In-game chat -> website
        void OnPlayerChat(BasePlayer player, string message, Chat.ChatChannel channel)
        {
            if (player == null || string.IsNullOrEmpty(message)) return;
            if (channel != Chat.ChatChannel.Global) return;
            PushToWebsite(player.displayName, message);
        }

        void PushToWebsite(string sender, string message)
        {
            var payload = new Dictionary<string, object> { { "sender", sender }, { "message", message } };
            var json = JsonConvert.SerializeObject(payload);
            var headers = new Dictionary<string, string> { { "Authorization", "Bearer " + _config.BearerSecret }, { "Content-Type", "application/json" } };
            webrequest.Enqueue(_config.IngestUrl, json, (code, response) => { }, this, RequestMethod.POST, headers, 10f);
        }

        // Website -> in-game chat
        void PollWebsiteChat()
        {
            webrequest.Enqueue(_config.ReadUrl, null, (code, response) =>
            {
                if (code != 200 || string.IsNullOrEmpty(response)) return;
                try
                {
                    var data = JsonConvert.DeserializeObject<ReadResponse>(response);
                    if (data?.messages == null) return;
                    foreach (var m in data.messages)
                    {
                        if (m.origin != "website") continue;
                        var id = m.created_at?.GetHashCode() ?? 0;
                        if (id == _lastPolledId) continue;
                        _lastPolledId = id;
                        Server.Broadcast($"<color=#ff8a52>Website Viewer</color>: {m.message}");
                    }
                }
                catch { }
            }, this, RequestMethod.GET, null, 10f);
        }

        private class ChatMsg
        {
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
