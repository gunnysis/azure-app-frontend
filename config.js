// 환경 시임(seam): 프론트엔드가 호출할 백엔드 베이스 URL.
// 호스트 기반 가드 — 프로덕션 호스트에서 서빙되면 어떤 사전 설정이 있어도
// 운영 백엔드를 강제한다. 다른 브랜치가 localhost config로 오배포돼도
// 백엔드 연결이 끊기지 않게 하는 재발방지 가드(2026-06-23 dev 오배포 사건).
// (CSP connect-src도 운영 백엔드 호스트만 허용하므로 localhost는 어차피 차단됨.)
(function () {
  "use strict";

  var PROD_API_BASE =
    "https://app-mlbackend-prod-kc-01-h4a6byekfzhkcday.koreacentral-01.azurewebsites.net";

  var host =
    (typeof window !== "undefined" &&
      window.location &&
      window.location.hostname) ||
    "";

  // 로컬 개발(localhost·직접 파일 열람)에서만 사전 설정/로컬 기본값을 허용
  var isLocalDev =
    host === "" ||
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "0.0.0.0" ||
    host === "[::1]";

  var isCloudflareHost =
    host.endsWith(".workers.dev") ||
    host.endsWith(".pages.dev") ||
    host === "single-energy-predict.jaeheeejeon.workers.dev";

  if (isLocalDev) {
    window.SINGLE_ENERGY_API_BASE_URL =
      window.SINGLE_ENERGY_API_BASE_URL || "http://127.0.0.1:8000";
  } else if (isCloudflareHost) {
    // Cloudflare 배포본은 같은 도메인의 Functions 프록시를 거쳐 Azure 백엔드를 호출한다.
    // 브라우저 CORS를 피하고, 실제 Azure API 주소 변경도 프론트 배포 안에서 흡수한다.
    window.SINGLE_ENERGY_API_BASE_URL = window.location.origin;
  } else {
    // 운영(또는 SWA 프리뷰 등 비로컬) 호스트 → 항상 운영 백엔드 강제
    window.SINGLE_ENERGY_API_BASE_URL = PROD_API_BASE;
  }
})();
