import { Router } from "express";
import ytdl from "@distube/ytdl-core";

const router = Router();

/* ── YouTube search by scraping ytInitialData from search page ── */
interface VideoResult {
  videoId: string;
  title: string;
  durationSeconds: number;
  channelName: string;
}

function parseDurationText(t: string): number {
  /* "3:45" → 225, "1:02:33" → 3753 */
  return t.split(":").reduce((acc, n) => acc * 60 + parseInt(n, 10), 0);
}

async function searchYouTube(q: string): Promise<VideoResult | null> {
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}&sp=EgIQAQ%3D%3D`; // filter: only videos
  const r = await fetch(url, {
    signal: AbortSignal.timeout(10_000),
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9",
      Accept: "text/html,application/xhtml+xml",
    },
  });

  if (!r.ok) return null;
  const html = await r.text();

  /* Extract ytInitialData JSON blob */
  const m = html.match(/var ytInitialData\s*=\s*(\{.+?\});\s*(?:<\/script>|var )/s);
  if (!m) return null;

  let data: unknown;
  try { data = JSON.parse(m[1]); } catch { return null; }

  /* Walk to the video list */
  const sections: unknown[] =
    (data as any)?.contents
      ?.twoColumnSearchResultsRenderer
      ?.primaryContents
      ?.sectionListRenderer
      ?.contents ?? [];

  for (const section of sections) {
    const items: unknown[] =
      (section as any)?.itemSectionRenderer?.contents ?? [];
    for (const item of items) {
      const v = (item as any)?.videoRenderer;
      if (!v?.videoId) continue;
      const raw: string = v.lengthText?.simpleText ?? "";
      return {
        videoId: v.videoId as string,
        title: (v.title?.runs?.[0]?.text as string) ?? "Unknown",
        durationSeconds: raw ? parseDurationText(raw) : 0,
        channelName: (v.ownerText?.runs?.[0]?.text as string) ?? "",
      };
    }
  }

  return null;
}

/* ── Format URL cache (90 min TTL) ───────────────────────────────── */
interface CachedFormat {
  url: string;
  mimeType: string;
  contentLength: string | null;
  expiresAt: number;
}
const fmtCache = new Map<string, CachedFormat>();

async function getAudioFormat(videoId: string): Promise<CachedFormat> {
  const hit = fmtCache.get(videoId);
  if (hit && Date.now() < hit.expiresAt) return hit;

  try {
    const r = await fetch(`https://pipedapi.smnz.de/streams/${videoId}`);
    if (!r.ok) throw new Error("Piped API failed");
    const data: any = await r.json();
    
    if (!data.audioStreams || data.audioStreams.length === 0) {
      throw new Error("No audio streams found");
    }

    const fmt = data.audioStreams.find((s: any) => s.mimeType.includes("mp4")) || data.audioStreams[0];

    const result: CachedFormat = {
      url: fmt.url,
      mimeType: (fmt.mimeType ?? "audio/webm").split(";")[0],
      contentLength: fmt.contentLength ? String(fmt.contentLength) : null,
      expiresAt: Date.now() + 90 * 60 * 1000,
    };
    fmtCache.set(videoId, result);
    return result;
  } catch (err) {
    throw new Error("Failed to get audio format from Piped API");
  }
}

/* ── GET /api/songs/find?q=artist+title ─────────────────────────── */
router.get("/songs/find", async (req, res) => {
  const q = (req.query.q as string | undefined)?.trim();
  if (!q) { res.status(400).json({ error: "Missing q" }); return; }

  const video = await searchYouTube(q);
  if (!video) { res.status(404).json({ error: "No results found" }); return; }

  /* Warm the format cache asynchronously */
  getAudioFormat(video.videoId).catch(() => {});

  res.json(video);
});

/* ── GET /api/songs/audio?id=VIDEO_ID ───────────────────────────── */
/* Full range-request-capable audio proxy                            */
router.get("/songs/audio", async (req, res) => {
  const id = (req.query.id as string | undefined)?.trim();
  if (!id) { res.status(400).json({ error: "Missing id" }); return; }

  const fmt = await getAudioFormat(id);

  const rangeHeader = req.headers.range as string | undefined;
  const upHeaders: Record<string, string> = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  };
  if (rangeHeader) upHeaders["Range"] = rangeHeader;

  const upstream = await fetch(fmt.url, { headers: upHeaders });

  res.setHeader("Content-Type", fmt.mimeType);
  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Access-Control-Allow-Origin", "*");

  const len = upstream.headers.get("content-length") ?? fmt.contentLength;
  if (len) res.setHeader("Content-Length", len);

  const cr = upstream.headers.get("content-range");
  if (cr) res.setHeader("Content-Range", cr);

  res.status(rangeHeader ? 206 : 200);

  if (!upstream.body) { res.end(); return; }

  const reader = upstream.body.getReader();
  req.on("close", () => reader.cancel().catch(() => {}));

  (async () => {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) { res.end(); return; }
        const ok = res.write(value);
        if (!ok) await new Promise<void>((r) => res.once("drain", r));
      }
    } catch { res.end(); }
  })();
});

export default router;
