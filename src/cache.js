// Mobile Local Asset Caching & Preloading Engine
// Powered by the browser CacheStorage API & ServiceWorker

export const CACHE_NAME = 'virtual-museum-v1';

export const STANDARD_ASSETS = [
  // Core gallery artwork (16 high-res exhibits)
  '/assets/images/mona_lisa.jpg',
  '/assets/images/starry_night.jpg',
  '/assets/images/last_supper.jpg',
  '/assets/images/vitruvian_man.jpg',
  '/assets/images/persistence_of_memory.jpg',
  '/assets/images/pearl_earring.jpg',
  '/assets/images/great_wave.jpg',
  '/assets/images/beethoven_portrait.jpg',
  '/assets/images/dizi_flute.jpg',
  '/assets/images/neanderthal_flute.jpg',
  '/assets/images/fujara.jpg',
  '/assets/images/ondes_martenot.jpg',
  '/assets/images/hammond_organ.jpg',
  '/assets/images/eiffel.jpg',
  '/assets/images/one_ring.png',
  '/assets/images/one_ring.jpg',

  // The One Ring 3D Model & PBR Engraved Textures
  '/assets/models/one_ring.glb',
  '/assets/models/one-ring/textures/ring_bronze_diffuse.png',
  '/assets/models/one-ring/textures/one_ring_inscription_gold.png',
  '/assets/models/one-ring/textures/ring_engrave_bump.png',
  '/assets/models/one-ring/textures/ring_engrave_roughness.png',

  // Lord of the Rings Typography & Audio Theme
  '/assets/fonts/Aniron.ttf',
  '/assets/fonts/AnironBold.ttf',
  '/assets/audio/the_one_ring_violin.mp3'
];

export const HIGH_ASSETS = [
  ...STANDARD_ASSETS,
  '/assets/models/eiffel.glb'
];

/**
 * Register Service Worker for seamless background caching & offline fallback
 */
export async function registerServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    return reg;
  } catch (err) {
    console.warn('[Cache] ServiceWorker registration notice:', err);
    return null;
  }
}

/**
 * Quickly inspect local browser cache to check if assets are already saved locally
 */
export async function checkAssetCache(mode = 'standard') {
  if (typeof window === 'undefined' || !('caches' in window)) {
    return { total: 0, hits: 0, allCached: false, supported: false };
  }

  const list = mode === 'high' ? HIGH_ASSETS : STANDARD_ASSETS;
  try {
    const cache = await caches.open(CACHE_NAME);
    let hits = 0;
    for (const url of list) {
      const match = await cache.match(url);
      if (match) hits++;
    }
    return {
      total: list.length,
      hits,
      allCached: hits === list.length,
      supported: true
    };
  } catch (err) {
    console.warn('[Cache] Check error:', err);
    return { total: list.length, hits: 0, allCached: false, supported: true };
  }
}

/**
 * Preloads all essential assets and caches them permanently in browser CacheStorage
 * Concurrency limited to 4 parallel workers for optimal mobile performance
 */
export async function preloadAndCacheAssets({ mode = 'standard', onProgress } = {}) {
  const list = mode === 'high' ? HIGH_ASSETS : STANDARD_ASSETS;
  const total = list.length;
  let current = 0;
  let hits = 0;
  let fetched = 0;

  const hasCaches = typeof window !== 'undefined' && 'caches' in window;
  let cache = null;
  if (hasCaches) {
    try {
      cache = await caches.open(CACHE_NAME);
    } catch (_) {}
  }

  const notify = (url, isHit, phase) => {
    current++;
    if (isHit) hits++;
    else fetched++;
    const pct = Math.min(100, Math.round((current / total) * 100));
    if (typeof onProgress === 'function') {
      onProgress({
        current,
        total,
        url,
        isHit,
        hitCount: hits,
        fetchedCount: fetched,
        pct,
        phase
      });
    }
  };

  // Helper for downloading a single asset
  async function processAsset(url) {
    if (cache) {
      try {
        const cachedMatch = await cache.match(url);
        if (cachedMatch) {
          notify(url, true, 'cache-hit');
          return;
        }
      } catch (_) {}
    }

    // Network fetch
    try {
      const res = await fetch(url);
      if (res.ok && cache) {
        try {
          await cache.put(url, res.clone());
        } catch (_) {}
      }
      notify(url, false, 'network-fetch');
    } catch (err) {
      console.warn('[Cache] Asset preload failed:', url, err);
      notify(url, false, 'error');
    }
  }

  // Pool execution: concurrency of 4
  const pool = 4;
  let idx = 0;
  const workers = Array.from({ length: Math.min(pool, total) }, async () => {
    while (idx < list.length) {
      const targetUrl = list[idx++];
      await processAsset(targetUrl);
    }
  });

  await Promise.all(workers);

  return {
    total,
    hits,
    fetched,
    allCached: hits === total
  };
}

/**
 * Helper to clear local museum cache if needed
 */
export async function clearAssetCache() {
  if (typeof window !== 'undefined' && 'caches' in window) {
    return caches.delete(CACHE_NAME);
  }
  return false;
}
