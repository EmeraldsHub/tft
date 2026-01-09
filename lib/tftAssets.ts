export function championIconUrl(characterId: string): string {
  const id = characterId.trim();
  if (!id) {
    return "";
  }
  return `/champions/${encodeURIComponent(id)}.png`;
}

export function itemIconUrl(itemName: string): string {
  const itemId = itemName.trim();
  if (!itemId) {
    return "";
  }
  return `/items/${encodeURIComponent(itemId)}.png`;
}
