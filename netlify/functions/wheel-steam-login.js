// Redirects the browser into Steam's own login page (OpenID 2.0). We never see or
// touch the player's Steam password — Steam authenticates them and redirects back
// with a signed claim we verify server-side in wheel-steam-callback.
const SITE = "https://untitledrx.com";

exports.handler = async function () {
  const params = new URLSearchParams({
    "openid.ns": "http://specs.openid.net/auth/2.0",
    "openid.mode": "checkid_setup",
    "openid.return_to": `${SITE}/.netlify/functions/wheel-steam-callback`,
    "openid.realm": SITE,
    "openid.identity": "http://specs.openid.net/auth/2.0/identifier_select",
    "openid.claimed_id": "http://specs.openid.net/auth/2.0/identifier_select",
  });
  return {
    statusCode: 302,
    headers: { Location: `https://steamcommunity.com/openid/login?${params.toString()}` },
    body: "",
  };
};
