// apps/bingo-frontend/src/services/cardCache.ts

const engineBase = import.meta.env.VITE_ENGINE_URL || 'http://localhost:4000';
const cardCache = new Map<number, any>();
let isPreloading = false;

export async function preloadAllCards() {
  if (isPreloading || cardCache.size >= 400) return;
  isPreloading = true;

  const ids = Array.from({ length: 400 }, (_, i) => i + 1);
  const concurrency = 25; // Faster chunking
  
  // We don't 'await' the whole thing in GameCanvas anymore, 
  // but we provide this as a background task.
  (async () => {
    for (let i = 0; i < ids.length; i += concurrency) {
      const chunk = ids.slice(i, i + concurrency);
      await Promise.all(
        chunk.map(async (id) => {
          if (cardCache.has(id)) return;
          try {
            const res = await fetch(`${engineBase}/card/${id}`, {
              headers: { 'ngrok-skip-browser-warning': 'true' }
            });
            const card = await res.json();
            if (card && card.cardId) cardCache.set(card.cardId, card);
          } catch (err) {
            // Silently fail, it will retry if user clicks it
          }
        })
      );
    }
    isPreloading = false;
  })();
}

// NEW: Force load specific IDs (User's cards) instantly

export async function ensureCardsLoaded(cardIds: number[]): Promise<void> {
  const missing = cardIds.filter(id => !cardCache.has(id));
  if (missing.length === 0) return;

  await Promise.all(
    missing.map(async (id) => {
      try {
        const res = await fetch(`${engineBase}/card/${id}`, {
          headers: { 'ngrok-skip-browser-warning': 'true' }
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const card = await res.json();
        if (card && card.cardId) cardCache.set(card.cardId, card);
      } catch (err) {
        console.error(`Failed to load card ${id}:`, err);
        // Optional: store a placeholder to avoid repeated attempts
        // cardCache.set(id, { numbers: null, error: true });
      }
    })
  );
}

export function getCachedCard(cardId: number) {
  return cardCache.get(cardId);
}