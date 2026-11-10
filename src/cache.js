// Mobile Local Asset Caching & Preloading Engine
// Powered by the browser CacheStorage API & ServiceWorker

export const CACHE_NAME = 'virtual-museum-v1';

// Room 1 Spawn & Monument Essentials (must be ready to enter)
export const ESSENTIAL_SPAWN_ASSETS = [
  '/assets/fonts/Aniron.ttf',
  '/assets/fonts/AnironBold.ttf',
  '/assets/images/last_supper.jpg',
  '/assets/images/vitruvian_man.jpg',
  '/assets/models/one_ring.glb',
  '/assets/models/one-ring/textures/ring_bronze_diffuse.png',
  '/assets/audio/the_one_ring_violin.mp3'
];

// Remaining gallery wings (cached progressively in background)
export const SECONDARY_GALLERY_ASSETS = [
  '/assets/images/mona_lisa.jpg',
  '/assets/images/starry_night.jpg',
  '/assets/images/pearl_earring.jpg',
  '/assets/images/great_wave.jpg',
  '/assets/images/persistence_of_memory.jpg',
  '/assets/images/beethoven_portrait.jpg',
  '/assets/images/dizi_flute.jpg',
  '/assets/images/neanderthal_flute.jpg',
  '/assets/images/fujara.jpg',
  '/assets/images/ondes_martenot.jpg',
  '/assets/images/hammond_organ.jpg',
  '/assets/images/eiffel.jpg',
  '/assets/images/one_ring.png',
  '/assets/images/one_ring.jpg',
  '/assets/models/one-ring/textures/2000px-One_Ring_inscription.jpeg',
  '/assets/models/one-ring/textures/one_ring_inscription_gold.png',
  '/assets/models/one-ring/textures/ring_engrave_bump.png',
  '/assets/models/one-ring/textures/ring_engrave_roughness.png',
  '/assets/the_elder_wand.glb',
  '/assets/dumbledore.jpg',
  '/assets/Harry-Potter-and-SnapYT.App.webm'
];

export const STANDARD_ASSETS = [
  ...ESSENTIAL_SPAWN_ASSETS,
  ...SECONDARY_GALLERY_ASSETS
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
 * Quick fetch wrapper with abort timeout to avoid any network hanging
 */
async function fetchWithTimeout(url, timeoutMs = 2500) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    return res;
  } finally {
    clearTimeout(id);
  }
}

/**
 * Inspect local browser cache to check if assets are already saved locally
 */
export async function checkAssetCache(mode = 'standard') {
  if (typeof window === 'undefined' || !('caches' in window)) {
    return { total: 0, hits: 0, allCached: false, supported: false };
  }

  const list = ESSENTIAL_SPAWN_ASSETS;
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
 * Preloads essential spawn assets first for instant entry (1-2s max),
 * then cascades to remaining gallery wings in background
 */
export async function preloadAndCacheAssets({ mode = 'standard', onProgress } = {}) {
  const primaryList = ESSENTIAL_SPAWN_ASSETS;
  const secondaryList = mode === 'high' ? [...SECONDARY_GALLERY_ASSETS, '/assets/models/eiffel.glb'] : SECONDARY_GALLERY_ASSETS;
  const primaryTotal = primaryList.length;

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

  const notify = (url, isHit, phase, isBackground = false) => {
    current++;
    if (isHit) hits++;
    else fetched++;
    if (!isBackground && typeof onProgress === 'function') {
      const pct = Math.min(100, Math.round((current / primaryTotal) * 100));
      onProgress({
        current,
        total: primaryTotal,
        url,
        isHit,
        hitCount: hits,
        fetchedCount: fetched,
        pct,
        phase
      });
    }
  };

  async function processAsset(url, isBackground = false) {
    if (cache) {
      try {
        const cachedMatch = await cache.match(url);
        if (cachedMatch) {
          notify(url, true, 'cache-hit', isBackground);
          return;
        }
      } catch (_) {}
    }

    // Network fetch with 2.5s maximum timeout
    try {
      const res = await fetchWithTimeout(url, 2500);
      if (res && res.ok && cache) {
        try {
          await cache.put(url, res.clone());
        } catch (_) {}
      }
      notify(url, false, 'network-fetch', isBackground);
    } catch (err) {
      notify(url, false, 'error', isBackground);
    }
  }

  // Phase 1: Preload Essential Spawn Assets with concurrency of 4
  const pool = 4;
  let idx = 0;
  const primaryWorkers = Array.from({ length: Math.min(pool, primaryTotal) }, async () => {
    while (idx < primaryList.length) {
      const targetUrl = primaryList[idx++];
      await processAsset(targetUrl, false);
    }
  });

  await Promise.all(primaryWorkers);

  // Phase 2: Kick off remaining gallery wing assets in background (non-blocking)
  setTimeout(() => {
    let secIdx = 0;
    Array.from({ length: 3 }, async () => {
      while (secIdx < secondaryList.length) {
        const targetUrl = secondaryList[secIdx++];
        await processAsset(targetUrl, true);
      }
    });
  }, 100);

  return {
    total: primaryTotal,
    hits,
    fetched,
    allCached: hits === primaryTotal
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
