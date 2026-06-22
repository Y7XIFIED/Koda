export type iTunesTrack = {
  trackId: number;
  trackName: string;
  artistName: string;
  collectionName: string;
  artworkUrl: string;
  previewUrl: string;
  durationMs: number;
  genre?: string;
  releaseYear?: string;
  artistId?: number;
};

export async function searchMusic(term: string, limit = 30): Promise<iTunesTrack[]> {
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=music&entity=song&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("iTunes search failed");
  const data = await res.json();
  return mapResults(data.results);
}

export async function getArtistTracks(artistId: number): Promise<iTunesTrack[]> {
  const url = `https://itunes.apple.com/lookup?id=${artistId}&entity=song&limit=25`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return mapResults((data.results as Record<string, unknown>[]).filter(r => r.wrapperType === "track"));
}

export async function getTopCharts(): Promise<iTunesTrack[]> {
  const url = "https://itunes.apple.com/us/rss/topsongs/limit=25/json";
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  const ids: string[] = (data.feed?.entry ?? []).map((e: any) => e.id?.attributes?.["im:id"]).filter(Boolean);
  if (!ids.length) return [];
  const lookup = await fetch(`https://itunes.apple.com/lookup?id=${ids.join(",")}`);
  if (!lookup.ok) return [];
  const lookupData = await lookup.json();
  return mapResults(lookupData.results);
}

export async function getSuggestions(term: string): Promise<iTunesTrack[]> {
  if (!term.trim()) return [];
  try {
    return await searchMusic(term, 5);
  } catch {
    return [];
  }
}

function mapResults(results: Record<string, unknown>[]): iTunesTrack[] {
  return (results ?? [])
    .filter((r) => r.previewUrl && (r.kind === "song" || r.wrapperType === "track"))
    .map((r) => ({
      trackId: r.trackId as number,
      trackName: (r.trackName as string) ?? "Unknown Track",
      artistName: (r.artistName as string) ?? "Unknown Artist",
      collectionName: (r.collectionName as string) ?? "Unknown Album",
      artworkUrl: ((r.artworkUrl100 as string) ?? "").replace("100x100bb", "600x600bb"),
      previewUrl: r.previewUrl as string,
      durationMs: (r.trackTimeMillis as number) ?? 30000,
      genre: (r.primaryGenreName as string) ?? undefined,
      releaseYear: r.releaseDate ? (r.releaseDate as string).slice(0, 4) : undefined,
      artistId: r.artistId as number | undefined,
    }));
}
