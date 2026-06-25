// 환경 시임(seam): 프론트엔드가 호출할 백엔드 베이스 URL.
// 호스트 기반 가드 — 프로덕션 호스트에서 서빙되면 어떤 사전 설정이 있어도
// 운영 백엔드를 강제한다. 다른 브랜치가 localhost config로 오배포돼도
// 백엔드 연결이 끊기지 않게 하는 재발방지 가드(2026-06-23 dev 오배포 사건).
// (CSP connect-src도 운영 백엔드 호스트만 허용하므로 localhost는 어차피 차단됨.)
(function () {
  "use strict";

  // 앱 버전(빌드 태그). 모든 텔레메트리에 application_Version으로 스탬핑돼(appinsights.js의
  // telemetry initializer) RUM 데이터를 배포 릴리스와 상관지을 수 있게 한다 —
  // 회귀가 보이면 "어느 배포부터인가"를 즉시 식별(재발방지). index.html의 ?v= 캐시버스트와 동일 유지.
  window.SINGLE_ENERGY_APP_VERSION = "20260625-rum-enrich";

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

  if (isLocalDev) {
    window.SINGLE_ENERGY_API_BASE_URL =
      window.SINGLE_ENERGY_API_BASE_URL || "http://127.0.0.1:8000";
  } else {
    // 운영(또는 SWA 프리뷰 등 비로컬) 호스트 → 항상 운영 백엔드 강제
    window.SINGLE_ENERGY_API_BASE_URL = PROD_API_BASE;
  }

  // Application Insights(브라우저 RUM) 연결 문자열.
  // 비밀이 아님(브라우저 노출 전제, MS 공식) — 운영 호스트에서만 주입해 로컬 dev 텔레메트리 오염 방지.
  // 수집 엔드포인트(IngestionEndpoint)는 CSP connect-src에도 등록돼야 한다(staticwebapp.config.json).
  // appi-frontend-prod-kc-02 / RG project-1st-team-3 / koreacentral
  if (!isLocalDev) {
    window.SINGLE_ENERGY_APPINSIGHTS_CONNECTION_STRING =
      "InstrumentationKey=f1e6f761-35ab-4261-894d-f6856858f415;IngestionEndpoint=https://koreacentral-0.in.applicationinsights.azure.com/;LiveEndpoint=https://koreacentral.livediagnostics.monitor.azure.com/;ApplicationId=0fb2a279-140d-436e-bed6-3dfb38124942";
  }
})();
