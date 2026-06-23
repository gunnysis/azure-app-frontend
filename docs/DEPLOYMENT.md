# 프론트엔드 운영 배포 정보 — Azure Static Web Apps

> **대상:** `azure-app-frontend` (전기요금 예측 서비스 프론트엔드, 순수 정적 사이트)
> **배포 플랫폼:** Azure Static Web Apps
> **작성일:** 2026-06-23
> **근거 문서:** [`../../docs/azure/info.md`](../../docs/azure/info.md) §2(Static Web Apps)·§4(백엔드)
> **상태:** 🟢 **정적 사이트 배포 완료**(2026-06-23, GitHub Actions `Build and Deploy` 성공, 커밋 `fd752d4`). `config.js`는 운영 백엔드 HTTPS URL로 전환됨. ⚠️ 단 **백엔드 연동(§5: 경로 `/predict`↔`/api/v1/predict`·인증·CORS) 미해소** → 현재 예측은 폴백(`localMockPredict`)으로 동작한다. 실연동은 §5 합의 후 §6의 8~10단계로 검증.
> ✅ **선결조건 해소(2026-06-23 실측 갱신)**: **SWA↔GitHub 연결은 이미 완료**됐다. Azure가 `origin/main`에 워크플로(`.github/workflows/azure-static-web-apps-thankful-desert-0cdb08500.yml`)를 **자동 커밋**했고, 배포 토큰 시크릿(`AZURE_STATIC_WEB_APPS_API_TOKEN_THANKFUL_DESERT_0CDB08500`)도 자동 등록됐다(§3.0 방법 A 완료). "push 시 자동 배포" 전제는 **성립한다**. ⚠️ 단, 이 정본 워크플로는 `output_location:"/"`·`skip_app_build` 미설정(Azure 기본값) — 빌드리스 강건화는 §3.2 참고.
> ⚠️ **요청 데이터(페이로드) 계약 미확정**: 프론트가 백엔드로 보내는 요청 본문 필드는 **확정값이 아니며 변경될 수 있다.** 백엔드/ML 팀과 최종 합의 전까지 잠정(provisional)으로 취급한다 — 상세 §5.2.

> 📌 **줄번호 인용 주의(유지보수):** 본 문서의 `script.js:NN` 인용은 **2026-06-23 커밋 기준**이다. 코드 수정 시 줄번호가 밀릴 수 있으니 **함수명(`buildPayload`, `normalizePredictionResponse`, `requestPrediction`)을 1차 기준**으로 찾고 줄번호는 보조로 쓸 것.

이 문서는 본 프론트엔드를 **운영(Production) 환경에 배포**하기 위한 **구현 설계서(Implementation Design)** 이자 운영 정보 기록이다.
`info.md`에서 **이 프로젝트(프론트)에 필요한 정보만 추출**하고, 프로젝트 실제 코드와의 정합성을 점검한 뒤, **무엇을 어떤 순서로 만들면 배포가 되는지**를 산출물 단위로 설계한다.

---

## 0. 구현 설계 개요 (Implementation Design)

**목표:** 순수 정적 프론트(`azure-app-frontend`)를 Azure Static Web Apps(Standard)에 **push 자동 배포(CI)** 가능한 상태로 만든다. 빌드 단계가 없으므로 구현은 본질적으로 **"산출물 3종 생성 + 정합성 게이트 통과"** 로 끝난다.

**설계 원칙**
- **빌드리스(buildless):** Oryx 빌드를 건너뛰고(`skip_app_build:true`) 저장소 루트를 그대로 업로드한다(§3).
- **환경 단일 seam:** 백엔드 URL은 `config.js` 한 곳(`window.SINGLE_ENERGY_API_BASE_URL`)에서만 주입한다 — 코드(`script.js`)는 손대지 않는다(§4).
- **최소 권한 보안 기본값:** 인라인 스크립트·외부 CDN **0개**를 실측해 CSP를 `script-src 'self'`로 고정한다(§3.1).
- **폴백 불투명성 차단:** 백엔드 실패 시에도 화면은 뜨지만(`localMockPredict`) 그건 폴백이다 — 검증은 "화면이 뜬다"가 아니라 **콘솔/네트워크로 실연동 200 확인**까지 본다(§6).

**산출물 매니페스트** — 이번 구현에서 생성/수정하는 파일 (2026-06-23 실측 기준)

| # | 파일 | 현재 상태 | 목표 | 설계 위치 |
|---|---|---|---|---|
| **A** | `.github/workflows/azure-static-web-apps-thankful-desert-0cdb08500.yml` | ✅ **Azure가 `origin/main`에 자동 생성·커밋 완료** | 정본 채택(수동 작성 불필요). 빌드리스 강건화는 선택 | §3.0·§3.2 |
| **B** | `staticwebapp.config.json` (루트) | **없음** | 신규 생성(보안헤더·캐시·CSP) | §3.1 |
| **C** | `config.js` | ✅ **운영 HTTPS URL로 전환·배포 완료**(`...koreacentral-01.azurewebsites.net`) | — | §4 |
| **D** | `script.js` `PREDICT_ENDPOINT`·인증 헤더 | `/predict`, 키 없음 | 백엔드 계약 합의 후 정합 | §5-#1·#2 |

> **A·B는 코드 변경 없이 추가만으로 동작**한다(선행 가능). **C·D는 백엔드 팀 합의(경로·인증·페이로드)에 종속** — §5 게이트 통과 전에는 운영 출시를 보류하고 스테이징 검증까지만 진행한다.

**구현 단계 (의존 순서)** — 각 단계는 선행 산출물에 의존한다.

| 단계 | 작업 | 산출물 | 선행 | 게이트 |
|---|---|---|---|---|
| 1 | 계약 확정 — 페이로드·API 경로·인증/CORS 합의(§5) | (합의 문서) | — | ❗**출시 게이트.** 미합의 시 4~5는 스테이징까지만 |
| 2 | ✅ `staticwebapp.config.json` 루트 추가·배포(§3.1) | B(완료) | 없음(선행 가능) | 배포 후 CSP 위반·이미지 export 회귀 점검(§6-10) |
| 3 | ✅ `config.js`를 운영 HTTPS URL로 전환·배포(§4) | C(완료) | 1(경로 합의) | `https://` 적용됨 |
| 4 | ✅ 커밋 `fd752d4` → `main` push → **Actions `Build and Deploy` green**(2026-06-23) | A(완료) | 2·3 | Actions green ✅ |
| 5 | 🟡 정적 배포 완료. **E2E 실연동 검증은 §5 합의 후**(§6 체크리스트 8~10) | — | 4 | 백엔드 200 실연동 + 폴백 경고 없음 |

---

## 1. 배포 대상 구성 (이 저장소)

순수 정적 사이트이므로 **빌드 단계가 없다.** 저장소 루트의 파일이 그대로 배포된다.

| 파일/폴더 | 역할 |
|---|---|
| `index.html` | 진입점 (단일 페이지, JS로 화면 전환) |
| `script.js` | 예측 요청·화면 렌더링 로직. **요청 페이로드 생성(`buildPayload()`)이 여기 있으며 계약 미확정(§5.2)** |
| `styles.css` | 스타일 |
| `config.js` | **API 베이스 URL 설정** (환경별로 변경 — 산출물 C, §4) |
| `assets/brand/` | 브랜드 SVG(`jjirit-icon.svg`·`jjirit-logo.svg`) — 파비콘·로고 |
| `assets/fonts/` | 디스플레이 폰트(Moneygraphy `.woff2` 2종) |
| `README.md`, `API_CONTRACT.md`, `CLAUDE.md`, `docs/` | 문서(서빙되지만 UI 미참조 — 무해) |

- 빌드 산출물 디렉터리 없음 → 배포 설정에서 `output_location`은 비워 둔다(아래 §3).
- GitHub 원격: `https://github.com/gunnysis/azure-app-frontend.git` (브랜치 `main`).

---

## 2. Azure Static Web Apps 리소스 정보 (`info.md` §2 추출)

| 항목 | 값 | 비고 |
|---|---|---|
| 서비스 | Azure Static Web Apps | 정적 호스팅 + 관리형 HTTPS |
| Location | **East Asia** | 리소스/스테이징 리전. 정적 콘텐츠는 글로벌 CDN으로 서빙(Standard는 enterprise-grade edge 옵션 가능, §7.2) |
| SKU(요금제) | **Standard** | 2026-06-23 확인. SLA·private endpoint·IP 제한 등 활성 가능(§7.2) |
| Resource group | `project-1st-team-3` | 백엔드·ML과 동일 RG |
| Subscription | `대한상공회의소` | |
| Deployment name | `Microsoft.Web-StaticApp-Portal-3b3c4a0e-9782` | 포털 생성 배포 |
| Correlation ID | `f5801032-0a4a-45b9-b5e1-a9cf4af46cb2` | 배포 추적용 |
| 생성 시작 | 2026-06-23 15:09:00 | |

### 2.1 `info.md`에 없어 **포털에서 확인이 필요한 값** (출시 전 채울 것)

| 확인 항목 | 채울 값 | 확인 위치 |
|---|---|---|
| SWA 리소스 이름 | (예: `swa-…`) | 포털 → Static Web App 개요 |
| 기본 호스트네임 | `https://<생성된-이름>.<region-hash>.azurestaticapps.net` | 개요 "URL" |
| 배포 토큰(또는 OIDC) | `AZURE_STATIC_WEB_APPS_API_TOKEN_<랜덤접미사>` (§3) | "배포 토큰 관리" |
| 연결된 GitHub 저장소/워크플로 | `gunnysis/azure-app-frontend` | 포털 또는 `.github/workflows/` |

> ℹ️ 위 항목들은 본 프로젝트 운영에 **반드시 필요**하지만 `info.md` §2에 기재되어 있지 않다. 확인 후 본 표를 갱신할 것.

> **현재 플랜: Standard.** SLA 보장 + 커스텀 도메인 5개 + 스테이징 환경 10개를 제공하며, IP 제한(`networking.allowedIpRanges`)·private endpoint·enterprise-grade edge·Front Door 연동(`forwardingGateway`) 등 **Standard 전용 보안/네트워킹 옵션**을 활성화할 수 있다(상세 §7.2). 본 MVP는 공개 서비스라 이들 옵션은 선택 적용이며, SLA·확장 여력 측면에서 Standard 유지가 적합하다.

---

## 3. 배포 방식 — GitHub Actions (공식 권장)

Azure Static Web Apps는 **GitHub Actions로 push 시 자동 배포**된다. SWA를 GitHub 저장소와 연결하면 워크플로 파일과 배포 토큰이 자동 구성된다.

- 워크플로 파일 경로: `.github/workflows/azure-static-web-apps-<랜덤이름>.yml`
- 배포 액션: `Azure/static-web-apps-deploy@v1`
- 비밀값: `${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN_<랜덤접미사> }}` — 자동 생성되는 **실제 시크릿명에는 랜덤 접미사**가 붙는다(예: `..._GENTLE_WATER`). 워크플로의 토큰 참조와 저장소 Secret 이름이 **정확히 일치**해야 한다.

### 3.0 ✅ (완료) SWA ↔ GitHub 연결 상태

**연결은 이미 완료됐다(2026-06-23 `git fetch` 실측).** 포털에서 **방법 A(GitHub 연결)** 가 수행되어 Azure가 다음을 자동 구성했다:

| 항목 | 실제 값(실측) |
|---|---|
| 자동 커밋된 워크플로 | `origin/main:.github/workflows/azure-static-web-apps-thankful-desert-0cdb08500.yml` |
| 자동 등록된 시크릿 | `AZURE_STATIC_WEB_APPS_API_TOKEN_THANKFUL_DESERT_0CDB08500` (워크플로가 정확히 이 이름을 참조) |
| 상태 | ✅ 로컬·`origin/main` 동기화됨. 배포 커밋 `fd752d4` push로 **`Build and Deploy` green** 확인(2026-06-23) |

> ✅ 워크플로·시크릿이 모두 갖춰져 **`main` push마다 자동 배포가 동작**한다. 아래 방법 B/C는 **이미 불필요**하며, 참고용으로만 남긴다.
> 🔴 **중복 워크플로 금지:** 수동으로 `azure-static-web-apps.yml`을 또 만들면 정본과 **이중 배포**가 돈다. 정본 1개만 유지할 것(이 작업 중 생성했던 수동 중복본은 제거됨).

<details><summary>참고: 미연결 상태였다면 썼을 대안(현재 불필요)</summary>

- **방법 B — 워크플로 수동 작성:** 포털 *배포 토큰 관리*에서 토큰을 복사해 저장소 Secret으로 등록하고 워크플로를 직접 작성. **정본이 이미 있으므로 쓰지 말 것.**
- **방법 C — 즉시 1회 배포(CI 없이):** `swa deploy ./ --deployment-token <토큰> --env production` (SWA CLI). CI 우회 빠른 검증용.

</details>

> **배포 인증 정책 2가지** (포털 → *배포 구성*에서 선택):
> - **배포 토큰(권장 기본값)**: SWA가 발급한 토큰을 저장소 Secret으로 저장. 위 워크플로의 기본 방식.
> - **OIDC(Identity token)**: GitHub `id-token` 권한으로 토큰 없이 인증. 장기 비밀값을 두지 않아 더 안전. 워크플로에 `permissions: id-token: write`와 `github_id_token` 단계가 추가됨.

### 빌드 없는 정적 사이트용 핵심 설정값

순수 정적 사이트(빌드 없음)는 Oryx 자동 빌드를 **건너뛰는 것**이 안전하다. `skip_app_build` 없이 두면 Oryx가
빌드를 시도하다 *"unable to determine the location of the app artifacts"* 오류로 실패하는 사례가 잦다(공식 이슈 다수).

```yaml
with:
  azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN }}
  repo_token: ${{ secrets.GITHUB_TOKEN }}   # PR 코멘트 등 GitHub 연동용(자동 설정)
  action: "upload"
  app_location: "/"        # 저장소 루트에 정적 파일이 있음
  api_location: ""         # SWA 내장 API 미사용(백엔드는 별도 App Service)
  output_location: ""      # 빌드 산출물 없음 → 빈 문자열
  skip_app_build: true     # 정적 사이트 → Oryx 빌드 건너뜀(아티팩트 위치 오류 예방)
```

> 근거: Microsoft Learn(Build configuration) — `skip_app_build: true`일 때 `app_location`은 배포할 파일 위치, `output_location`은 빈 문자열(`''`)로 둔다.
> `api_location`을 비우는 이유: 예측 API는 SWA의 관리형 Functions가 아니라 **별도 Azure App Service 백엔드**(§4)가 담당한다.
> ⚠️ `skip_app_build: true`를 쓰면 `staticwebapp.config.json`이 **`app_location`에 그대로 포함**되는지 확인할 것(빌드가 없어 복사 단계가 생략되므로).

### 3.1 (권장) `staticwebapp.config.json`

보안 헤더·404 처리를 위해 저장소 루트(`app_location` 기준)에 추가 권장. 파일 최대 크기 **20 KB**.

아래는 **이 저장소 코드를 실측해 도출한** 설정이다(인라인 스크립트·핸들러 0개, 외부 CDN 의존 없음, 리포트 이미지 export가 `blob:` 사용 — 근거는 표 아래).

```json
{
  "navigationFallback": {
    "rewrite": "/index.html",
    "exclude": ["/assets/*", "/*.{css,js,json,ico,svg,png,jpg,webp,woff,woff2}"]
  },
  "routes": [
    {
      "route": "/assets/*",
      "headers": { "Cache-Control": "public, max-age=31536000, immutable" }
    }
  ],
  "globalHeaders": {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' https://app-mlbackend-prod-kc-01-h4a6byekfzhkcday.koreacentral-01.azurewebsites.net; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"
  }
}
```

**CSP 각 지시문의 실측 근거**
| 지시문 | 값 | 근거(이 저장소 실측) |
|---|---|---|
| `script-src` | `'self'` | `index.html`에 인라인 `<script>`·`on*=` 핸들러 **0개**, 외부 스크립트(CDN) 없음 → `'unsafe-inline'` 불필요(강화) |
| `style-src` | `'self'` | 인라인 `style=`·`<style>` **0개**. `el.style.x=` DOM 설정은 CSP 무관. export `<style>`는 **blob 이미지 내부**(라이브 DOM 아님) |
| `img-src` | `'self' data: blob:` | **리포트 이미지 export가 `URL.createObjectURL`(blob:) 로 SVG/canvas를 그림** — `blob:` 누락 시 **이미지 저장/공유가 깨진다** |
| `connect-src` | `'self' <백엔드>` | `fetch`는 백엔드 1곳뿐 → 누락 시 예측 요청 차단 |
| `font-src` | `'self'` | 폰트는 `assets/fonts` 로컬 |

> **glob 문법(공식 규칙):** 와일드카드 `*`는 **경로 끝에만**, 확장자 필터는 `*.{ext,ext}` 형식만 유효. `/*.css`처럼 쓰지 말고 `/*.{css,js,...}`로 묶는다.
> **성능:** `/assets/*`만 `immutable` 장기 캐시한다. **루트의 `config.js`·`script.js`·`index.html`에는 장기 캐시를 걸지 말 것** — 환경 전환(`config.js`)이나 코드 변경이 즉시 반영되지 않는다(SWA 기본 재검증 캐시 유지).
> **`navigationFallback`은 선택사항:** 이 앱은 URL 기반 클라이언트 라우팅이 없어 새로고침/딥링크 문제가 없다. 보안 헤더만으로도 충분하다.
> **적용 후 검증:** 배포 후 브라우저 콘솔에 CSP 위반 로그가 없는지, **리포트 "이미지 저장/공유"가 정상 동작**하는지 확인. 만약 스타일 위반이 보이면 `style-src`에 `'unsafe-inline'`을 한시적으로 추가하고 원인을 추적한다.
> ⚠️ `globalHeaders`의 `Access-Control-Allow-*`는 **SWA 자체 응답**에만 적용된다. 백엔드 `fetch`의 CORS는 **백엔드가 제어**한다(§5.1).

### 3.2 (산출물 A) 정본 워크플로 — Azure 자동생성본 + 빌드리스 강건화(적용 완료)

> **상태:** 산출물 A는 §3.0대로 Azure가 자동 커밋한 정본을 채택했고, 빌드리스 강건화 2줄을 **적용·배포 완료**했다(커밋 `fd752d4`, Actions `Build and Deploy` green — `skip_app_build`로 Oryx 빌드 단계 없이 업로드 성공 확인).

**현재 정본(`azure-static-web-apps-thankful-desert-0cdb08500.yml`)의 핵심 `with:` — 적용 후:**

```yaml
      - uses: actions/checkout@v4   # ✅ @v3→@v4 상향(Node20 폐기 대응)
        with:
          submodules: true
          lfs: false
      - uses: Azure/static-web-apps-deploy@v1
        with:
          azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN_THANKFUL_DESERT_0CDB08500 }}
          repo_token: ${{ secrets.GITHUB_TOKEN }}
          action: "upload"
          app_location: "/"        # ✅ 정합
          api_location: ""         # ✅ 정합(내장 API 미사용)
          output_location: ""      # ✅ 강건화 적용(빌드리스 → 빈 문자열)
          skip_app_build: true     # ✅ 강건화 적용(Oryx 빌드 건너뜀)
```

**적용 이력 — 빌드리스 강건화 2줄(배포로 검증됨):**

| 항목 | 변경 | 결과 |
|---|---|---|
| `output_location` | `"/"` → `""` | 빌드 산출물 없음을 의미상 정확히 표현 |
| `skip_app_build` | (없음) → `true` | Oryx 빌드 단계 생략 — Actions 로그에서 빌드 없이 업로드 확인 |

**✅ 후속 검토 항목 해소 — `actions/checkout@v3` → `@v4` 상향 완료:**
> 2026-06-23 배포 Actions annotation(*"Node.js 20 is deprecated … checkout@v3 … forced to run on Node.js 24"*)에 따라 **`@v4`로 상향 적용**했다. CI 설정 변경이라 §5 게이트와 무관하게 진행.

> **시크릿:** 정본은 실제 시크릿명(`...THANKFUL_DESERT_0CDB08500`)을 정확히 참조 → 추가 조치 불필요.
> **OIDC 전환 시(선택):** `permissions: id-token: write` + `github_id_token` 입력 추가. 장기 비밀값 제거로 더 안전.

---

## 4. 프론트 ↔ 백엔드 연동 정보

프론트는 정적 파일이지만 런타임에 **백엔드 App Service**로 예측 요청을 보낸다.

| 항목 | 값 |
|---|---|
| 백엔드 App 이름 | `app-mlbackend-prod-kc-01` (`info.md` §4) |
| 백엔드 도메인 | `https://app-mlbackend-prod-kc-01-h4a6byekfzhkcday.koreacentral-01.azurewebsites.net` |
| 리전 | Korea Central (백엔드) / East Asia (프론트 SWA) |
| 현재 `config.js` 값 | `http://127.0.0.1:8000` (**로컬 개발 기본값**) |

### 운영 배포 시 `config.js` 변경

```js
// config.js — 운영
window.SINGLE_ENERGY_API_BASE_URL =
  window.SINGLE_ENERGY_API_BASE_URL ||
  "https://app-mlbackend-prod-kc-01-h4a6byekfzhkcday.koreacentral-01.azurewebsites.net";
```

> 프론트는 `${API_BASE_URL}/predict` (`PREDICT_ENDPOINT`, `script.js:6`)로 호출한다. 베이스 URL만 바꾸면 경로가 따라 붙는다 — 단 **경로 정합성 문제 있음(§5 참조).**
> ⚠️ **혼합 콘텐츠 주의:** SWA는 HTTPS로 서빙되므로 `config.js`의 베이스 URL은 **반드시 `https://`** 여야 한다. `http://`로 두면 브라우저가 요청을 차단하고 프론트는 조용히 로컬 폴백(`localMockPredict`)으로 빠진다(겉으론 화면이 떠 오류로 안 보임 — §6-9 검증 필수).
> ℹ️ `config.js`를 직접 커밋하면 운영 URL이 저장소에 들어간다. 환경 분리가 필요하면 배포 단계에서 `config.js`를 치환하는 방식을 검토한다(현재는 단일 환경이라 직접 수정으로 충분).

---

## 5. ⚠️ 출시 전 필수 정합성 점검 (코드 ↔ 백엔드 계약)

프론트 코드와 백엔드(`info.md`) 계약을 대조한 결과 **연동을 막는 불일치 2건**과 **미확정 계약 1건**을 확인했다. **배포만으로는 동작하지 않으므로** 출시 전 반드시 해소/합의할 것.

| # | 항목 | 프론트 현재 | 백엔드(`info.md`) | 조치 |
|---|---|---|---|---|
| 1 | **API 경로** (불일치) | `POST {base}/predict` (`script.js:6`) | `/api/v1/predict` (§6·§7) | 양 팀 합의 후 한쪽을 맞춤(프론트 `PREDICT_ENDPOINT` 수정 또는 백엔드 라우트 추가) |
| 2 | **인증 헤더** (불일치) | `Content-Type`만 전송, **키 없음** (`script.js:200`) | `X-API-Key`(`API_KEY`) 기대 (§6) | 아래 보안 주의 참고 |
| 3 | **요청 페이로드** (미확정) | `buildPayload()` 7개 필드(에어컨 사용시간/타입/소비전력 중심) — **잠정** | ML 입력 피처는 변경 이력 있음(`info.md` §4.1) | §5.2 — 백엔드/ML과 필드 최종 합의 후 `buildPayload()`·`API_CONTRACT.md` 동기화 |

> **보안 주의 (#2):** `API_KEY`를 정적 프론트 `config.js`/`script.js`에 넣으면 **브라우저에 그대로 노출**된다. 권장 대안:
> - (A) 백엔드가 SWA 도메인 Origin에 한해 **키 없이 CORS 허용**(공개 예측 API로 운영), 또는
> - (B) SWA **관리형 Functions를 프록시**로 두고 키를 서버측에 보관, 또는
> - (C) 레이트리밋/봇 차단 등 다른 보호로 대체.
> 정적 사이트 특성상 (A) 또는 (B)가 현실적이다. 팀 결정 필요.

### 5.1 CORS (백엔드 측 조치 필요)

백엔드 CORS 허용 Origin에 **SWA 운영 도메인**을 추가해야 브라우저 요청이 통과한다.
현재 `API_CONTRACT.md` 예시는 `http://127.0.0.1:4202`만 허용한다.

```
허용 Origin에 추가: https://<SWA-호스트네임>.azurestaticapps.net
(커스텀 도메인 사용 시 해당 도메인도)
```

> ⚠️ SWA는 **PR마다 별도 미리보기(staging) 환경**을 `https://<이름>-<해시>.<region>.azurestaticapps.net` 형태로 만든다. PR 환경에서 실연동 테스트가 필요하면 백엔드 CORS를 와일드카드/정규식으로 해당 패턴까지 허용해야 한다(운영만 검증한다면 생략 가능).

### 5.2 ⚠️ 요청 페이로드 — **미확정(변경 가능), 잠정 계약**

> 프론트가 백엔드로 보내는 **요청 본문 필드는 현재 확정값이 아니다.** 백엔드/ML 팀의 입력 스펙이 정해지면 **추가·삭제·개명·타입 변경**될 수 있으므로, 아래 표는 **2026-06-23 기준 잠정값(provisional)** 으로만 본다.

**현재(잠정) 요청 본문** — `buildPayload()` (`script.js:151`) 생성, `POST {base}/predict`:

| 필드(잠정) | 타입 | 비고 |
|---|---|---|
| `region` | string | MVP 고정 `"mapo"` |
| `housing_type` | string | MVP 고정 `"oneroom"` |
| `household_size` | number | MVP 고정 `1` |
| `has_aircon` | boolean | 하루 사용 시간 > 0 이면 `true` |
| `aircon_hours_per_day` | number | 하루 에어컨 사용 시간(0~24, 0.5 단위) |
| `aircon_power_w` | number \| null \| 0 | 소비전력(W). 비우면 `null`(평균값), 미사용(0시간)이면 `0` |
| `aircon_type` | string | `fixed`/`inverter`/`unknown`/`none` |

**변경에 대한 운영 원칙**
1. **단일 변경 지점:** 요청 필드는 오직 `buildPayload()` (`script.js:151`)에서 생성된다. 계약이 바뀌면 **이 함수만 수정**하면 되고, 라우터/렌더링 계층은 무관하다.
2. **동기화 대상:** 필드 변경 시 `buildPayload()` ↔ [`../API_CONTRACT.md`](../API_CONTRACT.md)(§2·§3) ↔ 백엔드 요청 스키마를 **항상 함께** 갱신한다. `API_CONTRACT.md`가 프론트↔백엔드 단일 계약서이므로 우선 갱신한다.
3. **출시 게이트:** 페이로드 계약이 **합의·고정되기 전에는 운영 출시 보류.** 잠정 스펙으로 배포하면 백엔드 스펙 변경 시 즉시 깨진다.

**범위 구분 (혼동 주의)**
- 위 *요청 필드*는 **프론트의 출력 계약** → 변경 시 **프론트가 `buildPayload()` 수정**.
- *ML 입력 피처*(예: `avg_temp`→`avg_temperature`, int64→double 등 `info.md` §4.1) 변환은 **백엔드 책임** → 프론트 무관. 단, ML 피처 변경이 **요청 필드 추가를 유발**할 수 있어 위 미확정성의 원인이 된다.

**응답 계약(상대적으로 안정)**: 프론트가 의존하는 값은 `predicted_kwh`(필수)·`estimated_bill`(선택) 두 개뿐이다(`API_CONTRACT.md` §4, `normalizePredictionResponse()` `script.js:179`). 응답 키가 바뀌면 `normalizePredictionResponse()`를 함께 조정한다.

---

## 6. 운영 배포 절차 (체크리스트)

```
[x] 0. ✅ (완료) SWA ↔ GitHub 연결 — Azure 자동생성 워크플로 + 시크릿 등록 완료 (§3.0)
[ ] 1. SWA 포털 정보 확인 → §2.1 표의 빈 값 채우기 (리소스명/호스트네임/토큰) — **8~10단계 검증에 호스트네임 필요**
[x] 2. ✅ config.js를 운영 백엔드 HTTPS URL로 변경·배포 완료 (§4)
[ ] 3. (필수·출시게이트) 요청 페이로드 계약 확정 — buildPayload() ↔ API_CONTRACT.md ↔ 백엔드 스키마 합의/동기화 (§5-#3, §5.2)
[ ] 4. (필수) API 경로 불일치 해소 — /predict vs /api/v1/predict (§5-#1)
[ ] 5. (필수) 인증/CORS 정책 결정 및 적용 (§5-#2, §5.1)
[x] 6a. ✅ staticwebapp.config.json(산출물 B, §3.1) 루트 추가·배포 완료
[x] 6b. ✅ 정본 워크플로 빌드리스 강건화 — skip_app_build:true·output_location:"" 적용·배포 완료(§3.2)
[x] 6c. ✅ actions/checkout@v3 → @v4 상향 완료 — Node20 폐기 대응(§3.2)
[x] 7. ✅ 커밋 fd752d4 → main push → Actions `Build and Deploy` green (2026-06-23)
[ ] 8. SWA URL 접속 → 화면 동작 + 실제 예측(백엔드 200 응답) E2E 확인 — **§5 합의 후**
[ ] 9. 콘솔/네트워크 확인 — fallback 경고 없음 + 응답 200 + CSP 위반 없음 — **§5 합의 후**
       window.singleEnergyFrontend.getPredictEndpoint()
[ ] 10. 리포트 "이미지 저장/공유" 동작 확인 (CSP img-src blob: 회귀 점검, §3.1) — **배포됨, 지금 검증 가능**
```

> 백엔드 미응답 시 프론트는 `script.js`의 `localMockPredict`로 **자동 폴백**해 화면은 뜨지만, 이는 운영 정상 동작이 아니다. 8·9단계로 반드시 실연동을 확인할 것.
>
> **롤백:** 배포 단위는 Git 커밋이다. 문제 시 직전 정상 커밋으로 되돌려 `main`에 push하면 재배포된다(정적 사이트라 상태 없음). 긴급 시 포털에서 이전 배포로 전환하거나, PR 미리보기 환경(§5.1)에서 먼저 검증 후 운영 반영을 권장한다.

---

## 7. 보안 / HTTPS 참고

> 본 SWA는 **Standard 플랜**으로 운영한다(2026-06-23 확인). 아래는 TLS 현황 + Standard에서 **추가로 활성 가능한** 보안/네트워킹 옵션이다.

### 7.1 전송 구간 TLS 현황
- SWA 기본 호스트네임은 **관리형 HTTPS**(`*.azurestaticapps.net`, 무료 관리형 인증서)를 제공한다. 커스텀 도메인도 무료 관리형 SSL을 지원한다(Free·Standard 공통).
- 프론트(HTTPS) → 백엔드(App Service `azurewebsites.net`, HTTPS) 구간은 TLS로 보호된다.
- 단, **백엔드 → ML 엔드포인트 구간은 평문 HTTP**로 운영 중이다(`info.md` §3·§7, 마감 사유로 HTTPS 전환 보류 결정). 이는 백엔드 영역 리스크이며 프론트 배포와 무관하나, 운영 보안 현황으로 인지할 것.

### 7.2 Standard 플랜에서 활성 가능한 보안/네트워킹 옵션
> 모두 **Standard 전용**이며 기본은 비활성이다. 본 MVP는 공개 서비스라 필수는 아니지만, 요건에 따라 선택 적용한다.

| 옵션 | 내용 | 본 MVP 권고 |
|---|---|---|
| **SLA 보장** | Standard는 가용성 SLA 포함(Free는 SLA 없음) | 플랜 선택만으로 자동 적용 — 운영 서비스에 유리 |
| **Enterprise-grade edge** | 글로벌 엣지(118+ 로케이션) + **DDoS 보호** + IPv6/HTTP-2 | 공개 트래픽 보호·전세계 지연 개선이 필요하면 활성 검토 |
| **Private endpoint** | VNet 인바운드 전용 비공개 접근 | 공개 서비스이므로 **불필요**(내부 전용 전환 시에만) |
| **IP 제한** (`networking.allowedIpRanges`) | 특정 CIDR/서비스태그만 허용 | 공개 대상이라 미적용. 내부 데모/스테이징 한정 공개 시 사용 |
| **Forwarding gateway** (`forwardingGateway`) | Front Door 등 게이트웨이 뒤 배치 시 호스트/필수헤더 검증 | Front Door 직접 연동 시에만 |

> ⚠️ **상호 배타:** **Private endpoint와 Enterprise-grade edge는 동시 사용 불가** — Standard에서 둘 중 하나만 선택한다.
> ℹ️ `networking`·`forwardingGateway`는 `staticwebapp.config.json`에 정의하며 **Standard에서만 동작**한다(§3.1).

---

## 8. 참고 / 출처

**내부 문서**
- [`../../docs/azure/info.md`](../../docs/azure/info.md) — Azure 인프라 정보 (§2 SWA, §4 백엔드, §5~6 연동)
- [`../API_CONTRACT.md`](../API_CONTRACT.md) — 프론트↔백엔드 API 계약
- [`../README.md`](../README.md) — 실행/화면 흐름

**공식 문서 (팩트체크 근거)**
- [Build configuration for Azure Static Web Apps — Microsoft Learn](https://learn.microsoft.com/en-us/azure/static-web-apps/build-configuration)
- [Configure Azure Static Web Apps (staticwebapp.config.json) — Microsoft Learn](https://learn.microsoft.com/en-us/azure/static-web-apps/configuration)
- [Azure/static-web-apps-deploy — GitHub Action](https://github.com/Azure/static-web-apps-deploy)
- [Deploying to Azure Static Web App — GitHub Docs](https://docs.github.com/en/actions/how-tos/deploy/deploy-to-third-party-platforms/azure-static-web-app)
