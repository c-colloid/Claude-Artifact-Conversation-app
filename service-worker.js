/**
 * Service Worker for Multi Character Chat Application
 *
 * 機能:
 * - アプリケーションリソースのキャッシング
 * - オフライン対応
 * - 高速な2回目以降のロード
 *
 * キャッシュ戦略:
 * - Cache First: アプリケーションの静的リソース
 * - Network First: API リクエスト
 */

const CACHE_NAME = 'multi-char-chat-v1';
const RUNTIME_CACHE = 'multi-char-chat-runtime';

// キャッシュするリソース
const STATIC_RESOURCES = [
  '/',
  '/Multi%20character%20chat.jsx',
  '/Character%20Chat.jsx',
  // Tailwind CSS (CDN)
  'https://cdn.tailwindcss.com',
];

/**
 * Service Worker インストール
 * 静的リソースをキャッシュに保存
 */
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Caching static resources');
        return cache.addAll(STATIC_RESOURCES);
      })
      .then(() => {
        console.log('[Service Worker] Installation complete');
        // 新しい Service Worker を即座にアクティブ化
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[Service Worker] Installation failed:', error);
      })
  );
});

/**
 * Service Worker アクティベーション
 * 古いキャッシュを削除
 */
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');

  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            // 現在のバージョン以外のキャッシュを削除
            if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
              console.log('[Service Worker] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('[Service Worker] Activation complete');
        // すべてのクライアントで新しい Service Worker を制御
        return self.clients.claim();
      })
  );
});

/**
 * Fetch イベントハンドラー
 * リクエストの種類に応じて適切なキャッシュ戦略を適用
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // API リクエスト（Anthropic API）の場合: Network First
  if (url.hostname === 'api.anthropic.com') {
    event.respondWith(networkFirst(request));
    return;
  }

  // 静的リソースの場合: Cache First
  if (request.destination === 'script' ||
      request.destination === 'style' ||
      request.destination === 'image') {
    event.respondWith(cacheFirst(request));
    return;
  }

  // HTMLページの場合: Network First（ただしキャッシュフォールバック）
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }

  // その他のリクエスト: Network First
  event.respondWith(networkFirst(request));
});

/**
 * Cache First 戦略
 * キャッシュを優先し、なければネットワークから取得してキャッシュ
 *
 * @param {Request} request - フェッチリクエスト
 * @returns {Promise<Response>} レスポンス
 */
async function cacheFirst(request) {
  try {
    // キャッシュを確認
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      console.log('[Service Worker] Cache hit:', request.url);
      return cachedResponse;
    }

    // キャッシュになければネットワークから取得
    console.log('[Service Worker] Cache miss, fetching:', request.url);
    const networkResponse = await fetch(request);

    // レスポンスをキャッシュに保存（200 OKの場合のみ）
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.error('[Service Worker] Cache First failed:', error);

    // ネットワークエラーの場合、キャッシュを再確認
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    throw error;
  }
}

/**
 * Network First 戦略
 * ネットワークを優先し、失敗したらキャッシュから取得
 *
 * @param {Request} request - フェッチリクエスト
 * @returns {Promise<Response>} レスポンス
 */
async function networkFirst(request) {
  try {
    // ネットワークから取得を試みる
    const networkResponse = await fetch(request);

    // レスポンスをキャッシュに保存（200 OKの場合のみ、APIリクエスト以外）
    if (networkResponse && networkResponse.status === 200 &&
        !request.url.includes('api.anthropic.com')) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.log('[Service Worker] Network failed, trying cache:', request.url);

    // ネットワークエラーの場合、キャッシュから取得
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      console.log('[Service Worker] Serving from cache:', request.url);
      return cachedResponse;
    }

    // キャッシュにもない場合はエラー
    console.error('[Service Worker] No cache available for:', request.url);
    throw error;
  }
}

/**
 * メッセージハンドラー
 * クライアントからのメッセージを処理
 */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => caches.delete(cacheName))
        );
      }).then(() => {
        event.ports[0].postMessage({ success: true });
      })
    );
  }
});
