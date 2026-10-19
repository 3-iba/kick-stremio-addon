const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");
const axios = require("axios");

const VOD_DAYS = 7; // آخر كم يوم للمحفوظ

const MY_CHANNELS = [
  { username: "sxb", displayName: "SXB" }
];

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  Accept: "application/json",
  Referer: "https://kick.com/"
};

const api = async (path) =>
  (await axios.get(`https://kick.com/api/v2${path}`, { headers: HEADERS, timeout: 10000 })).data;

const builder = new addonBuilder({
  id: "org.mycustom.kick",
  version: "1.1.0",
  name: "قنواتي المخصصة في Kick",
  description: "بث مباشر ومحفوظات آخر أيام لقنوات محددة من Kick",
  resources: ["catalog", "meta", "stream"],
  types: ["channel"],
  idPrefixes: ["kick:"],
  catalogs: [{ type: "channel", id: "my_kick_list", name: "قنواتي في Kick" }]
});

const avatar = (name) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=53fc18&color=000&size=512`;

const recentVods = async (username) => {
  const list = await api(`/channels/${username}/videos`);
  const limit = Date.now() - VOD_DAYS * 24 * 60 * 60 * 1000;
  return (Array.isArray(list) ? list : [])
    .filter((v) => new Date(v.created_at).getTime() >= limit)
    .map((v) => ({
      uuid: v.video?.uuid || v.uuid || String(v.id),
      title: v.livestream?.session_title || "محفوظ",
      date: v.created_at,
      thumb: v.livestream?.thumbnail?.src || v.thumbnail?.src,
      source: v.source
    }));
};

// 1. القنوات
builder.defineCatalogHandler(async () => ({
  metas: MY_CHANNELS.map((ch) => ({
    id: `kick:${ch.username}`,
    type: "channel",
    name: ch.displayName,
    poster: avatar(ch.displayName),
    posterShape: "square"
  }))
}));

// 2. تفاصيل القناة: البث المباشر + المحفوظات
builder.defineMetaHandler(async ({ id }) => {
  const username = id.split(":")[1];
  const ch = MY_CHANNELS.find((c) => c.username === username);
  if (!ch) return { meta: null };

  const videos = [
    {
      id: `kick:${username}:live`,
      title: "🔴 البث المباشر",
      released: new Date().toISOString()
    }
  ];

  try {
    const vods = await recentVods(username);
    vods.forEach((v) =>
      videos.push({
        id: `kick:${username}:vod:${v.uuid}`,
        title: v.title,
        released: new Date(v.date).toISOString(),
        thumbnail: v.thumb
      })
    );
  } catch (e) {
    console.error("خطأ في جلب المحفوظات:", e.message);
  }

  return {
    meta: {
      id,
      type: "channel",
      name: ch.displayName,
      poster: avatar(ch.displayName),
      videos
    }
  };
});

// 3. الروابط
builder.defineStreamHandler(async ({ id }) => {
  const [prefix, username, kind, uuid] = id.split(":");
  if (prefix !== "kick" || !username) return { streams: [] };

  try {
    if (kind === "live") {
      const data = await api(`/channels/${username}`);
      if (data.livestream && data.playback_url) {
        return {
          streams: [{ title: `🔴 مباشر - ${username}`, url: data.playback_url }]
        };
      }
    } else if (kind === "vod") {
      const vods = await recentVods(username);
      const v = vods.find((x) => x.uuid === uuid);
      if (v?.source) {
        return { streams: [{ title: v.title, url: v.source }] };
      }
    }
  } catch (e) {
    console.error("خطأ في جلب الرابط:", e.message);
  }
  return { streams: [] };
});

serveHTTP(builder.getInterface(), { port: process.env.PORT || 7000 });
