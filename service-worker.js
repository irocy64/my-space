// Service Worker - 离线缓存 v2
const CACHE_NAME = 'my-space-v2';
const CORE_ASSETS = [
  './index.html',
  './manifest.json',
  './icon.jpg'
];

// 安装：缓存核心文件
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(CORE_ASSETS);
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

// 激活：清理旧缓存
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.filter(function(name) {
          return name !== CACHE_NAME;
        }).map(function(name) {
          return caches.delete(name);
        })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

// 请求拦截
self.addEventListener('fetch', function(event) {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // API请求不缓存，直接走网络
  if (url.hostname.includes('volces.com') || url.pathname.includes('/api/')) {
    event.respondWith(fetch(event.request).catch(function() {
      return new Response(JSON.stringify({ error: '网络请求失败' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      });
    }));
    return;
  }

  // 导航请求：网络优先，失败回退缓存
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).then(function(networkResponse) {
        const clone = networkResponse.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(event.request, clone);
        });
        return networkResponse;
      }).catch(function() {
        return caches.match('./index.html');
      })
    );
    return;
  }

  // 静态资源：缓存优先，后台更新
  event.respondWith(
    caches.match(event.request).then(function(cachedResponse) {
      if (cachedResponse) {
        fetch(event.request).then(function(networkResponse) {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then(function(cache) {
              cache.put(event.request, clone);
            });
          }
        }).catch(function() {});
        return cachedResponse;
      }
      return fetch(event.request).then(function(networkResponse) {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type === 'opaque') {
          return networkResponse;
        }
        const clone = networkResponse.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(event.request, clone);
        });
        return networkResponse;
      }).catch(function() {
        return new Response('离线状态，暂无缓存', { status: 503 });
      });
    })
  );
});
