export function slugifyRiotId(riotId: string, region: string) {
  const base = `${riotId}-${region}`
    .trim()
    .toLowerCase()
    .replace(/#/g, "-")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

  return base || `player-${Date.now()}`;
}
