// 절세3총사 서비스 워커 — 1단계: 최소 등록용 (캐싱/백그라운드 없음)
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// 1단계에서는 네트워크 요청을 그대로 통과시킴 (캐시 개입 없음)
self.addEventListener("fetch", (event) => {
  // 의도적으로 아무것도 하지 않음 — 브라우저 기본 동작 사용
});