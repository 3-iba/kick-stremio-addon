const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");
const axios = require("axios");

// 🔴 قائمة قنواتك المخصصة من Kick
const MY_CHANNELS = [
    { username: "sxb", displayName: "SXB" }
];

const builder = new addonBuilder({
    id: "org.mycustom.kick",
    version: "1.0.0",
    name: "قنواتي المخصصة في Kick",
    description: "إضافة لعرض قنوات محددة فقط من منصة Kick",
    resources: ["catalog", "stream"],
    types: ["tv"],
    catalogs: [
        { type: 'tv', id: 'my_kick_list', name: 'قنواتي في Kick' }
    ]
});

// 1. عرض قائمة القنوات
builder.defineCatalogHandler(async () => {
    const metas = MY_CHANNELS.map(ch => ({
        id: `kick:${ch.username}`,
        type: "tv",
        name: ch.displayName,
        poster: `https://ui-avatars.com/api/?name=${ch.displayName}&background=53fc18&color=000&size=512`,
        description: `بث مباشر لقناة ${ch.displayName} على Kick`
    }));

    return { metas };
});

// 2. جلب رابط البث المباشر
builder.defineStreamHandler(async (args) => {
    const [prefix, username] = args.id.split(":");

    if (prefix === "kick" && username) {
        try {
            const response = await axios.get(`https://kick.com/api/v2/channels/${username}`, {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
                }
            });

            const streamUrl = response.data?.playback_url;

            if (streamUrl) {
                return {
                    streams: [
                        {
                            title: `🔴 بث مباشر - ${username.toUpperCase()}`,
                            url: streamUrl,
                            type: "m3u8"
                        }
                    ]
                };
            }
        } catch (error) {
            console.error("خطأ في جلب بث القناة:", error.message);
        }
    }

    return { streams: [] };
});

// تشغيل السيرفر
serveHTTP(builder.getInterface(), { port: process.env.PORT || 7000 });
