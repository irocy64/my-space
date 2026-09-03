// Service Worker - 离线缓存
const CACHE_NAME = 'my-space-v1';
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

// 请求拦截：缓存优先，网络回退，成功后更新缓存
self.addEventListener('fetch', function(event) {
  // 只处理 GET 请求
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(function(cachedResponse) {
      // 缓存命中，直接返回，同时后台更新缓存
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

      // 缓存未命中，走网络，成功后存入缓存
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
        // 离线且无缓存，返回首页（单页应用）
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
        return new Response('离线状态，暂无缓存', { status: 503 });
      });
    })
  );
});
