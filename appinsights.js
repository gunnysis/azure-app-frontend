// Application Insights 브라우저 계측(RUM) 초기화 + 텔레메트리 seam.
// 정적 사이트라 의미 있는 로그는 클라이언트 텔레메트리(페이지뷰/JS에러/커스텀 이벤트)다.
// 설계 제약:
//  - CSP가 script-src 'self'(CDN/인라인 금지) → SDK는 assets/vendor에 셀프호스팅, 이 파일도 외부 'self' 스크립트.
//  - 연결 문자열은 비밀이 아님(브라우저 노출 전제, MS 공식) → config.js가 운영 호스트에서만 주입.
//  - 텔레메트리는 보조 기능 → SDK 미로딩/미설정/예외에도 앱 동작에 절대 영향 없게 모두 try/no-op.
// 로드 순서(index.html): config.js → ai.3.x.gbl.min.js(전역 Microsoft.ApplicationInsights) → appinsights.js → script.js
(function () {
  "use strict";

  // script.js가 안전하게 호출하는 텔레메트리 seam. 기본은 no-op(AI 없거나 로컬 dev).
  window.singleEnergyTrack =
    window.singleEnergyTrack ||
    function () {};
  window.singleEnergyTrackPage =
    window.singleEnergyTrackPage ||
    function () {};

  var connectionString = window.SINGLE_ENERGY_APPINSIGHTS_CONNECTION_STRING;
  var ns = window.Microsoft && window.Microsoft.ApplicationInsights;

  // 연결 문자열 미설정(로컬 dev) → 계측 비활성(무동작, 정상).
  if (!connectionString) {
    return;
  }
  // 재발방지: 운영인데(=연결 문자열 주입됨) SDK 전역이 없으면 번들 회귀 신호
  // (assets/vendor 번들 404 또는 index.html SRI 해시 불일치 → 브라우저가 스크립트 차단).
  if (!ns || !ns.ApplicationInsights) {
    if (window.console && window.console.warn) {
      window.console.warn(
        "[single-energy] App Insights 연결 문자열은 있는데 SDK 전역이 없어요 — " +
          "assets/vendor 번들 로드 실패(404) 또는 index.html SRI 무결성 불일치 의심.",
      );
    }
    return;
  }

  try {
    var appInsights = new ns.ApplicationInsights({
      config: {
        connectionString: connectionString,
        // 백엔드(/api/v1/estimate)는 크로스도메인 → 상관관계 헤더 주입 금지(백엔드 CORS 화이트리스트 보호).
        // 헤더를 안 붙이므로 의존성 호출은 '관찰'만 하고 프리플라이트에 영향 없음.
        enableCorsCorrelation: false,
        disableFetchTracking: false, // 백엔드 호출 지연/실패는 관찰(폴백 원인 분석에 유용)
        disableAjaxTracking: false,
        autoTrackPageVisitTime: true,
        // 이 앱은 History API 라우팅이 아니라 수동 상태머신 → 자동 라우트추적 끄고 화면 전환은 직접 trackPageView.
        enableAutoRouteTracking: false,
        disableExceptionTracking: false, // window.onerror/unhandledrejection 수집(런타임 회귀 조기 발견)
      },
    });
    appInsights.loadAppInsights();
    appInsights.trackPageView(); // 최초 진입 1회

    // seam을 실제 구현으로 교체.
    window.singleEnergyTrack = function (name, properties) {
      try {
        appInsights.trackEvent({ name: name }, properties || {});
      } catch (e) {
        /* 텔레메트리 실패는 무시 */
      }
    };
    window.singleEnergyTrackPage = function (name) {
      try {
        appInsights.trackPageView({ name: name });
      } catch (e) {
        /* 무시 */
      }
    };
    window.singleEnergyAppInsights = appInsights; // 콘솔 디버깅용
  } catch (e) {
    if (window.console && window.console.warn) {
      window.console.warn("[single-energy] App Insights init skipped:", e);
    }
  }
})();
