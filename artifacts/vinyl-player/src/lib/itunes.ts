export type iTunesTrack = {
  trackId: number;
  trackName: string;
  artistName: string;
  collectionName: string;
  artworkUrl: string;
  previewUrl: string;
  durationMs: number;
};

export async function searchMusic(term: string): Promise<iTunesTrack[]> {
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=music&entity=song&limit=30`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("iTunes search failed");
  const data = await res.json();

  return (data.results as Record<string, unknown>[])
    .filter((r) => r.previewUrl && r.kind === "song")
    .map((r) => ({
      trackId: r.trackId as number,
      trackName: (r.trackName as string) ?? "Unknown Track",
      artistName: (r.artistName as string) ?? "Unknown Artist",
      collectionName: (r.collectionName as string) ?? "Unknown Album",
      artworkUrl: ((r.artworkUrl100 as string) ?? "").replace(
        "100x100bb",
        "600x600bb"
      ),
      previewUrl: r.previewUrl as string,
      durationMs: (r.trackTimeMillis as number) ?? 30000,
    }));
}
