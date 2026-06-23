# 운영 배포 결과 및 구현 검토

> **대상:** `azure-app-frontend` (전기요금 예측 서비스 프론트엔드, 순수 정적 사이트)
> **배포 플랫폼:** Azure Static Web Apps (Standard)
> **검토일:** 2026-06-23
> **배포 커밋:** `fd752d4` — *운영 배포 준비: 정적 사이트 정리 + SWA 설정 추가*
> **연계 문서:** [`DEPLOYMENT.md`](./DEPLOYMENT.md) (구현 설계서/운영 정보)
> **SWA URL:** 🟢 라이브 검증 완료 → **https://thankful-desert-0cdb08500.7.azurestaticapps.net/**
> **상태:** 🟢 **정적 사이트 배포 성공·URL/보안헤더 라이브 검증** / 🟢 **dev→프로덕션 오배포 사건 근본 해결·재발방지 적용**(§1-A) / 🟢 **백엔드 실연동 5계층 어댑터로 해소·라이브 `source=live` 검증**(§3, 2026-06-23) — 예측이 **실제 ML 모델**로 동작

이 문서는 2026-06-23 **실제 배포를 수행한 결과**와, 그 결과를 설계(`DEPLOYMENT.md`)·백엔드 코드(`../../azure-app-backend`)와 대조한 **구현 검토**를 한 곳에 정리한다. §3·§5는 **curl 라이브 실측 + 백엔드 소스 대조**로 사실 확인했다. 이후 작업은 §6(다음 작업 후보)을 근거로 지시받아 진행한다.

---

## 1. 배포 결과 요약

| 항목 | 값 |
|---|---|
| 배포 커밋 | `fd752d4` (`main`에 push) |
| GitHub Actions Run | `28014127061` — `Build and Deploy Job` ✅ **success (1m21s)** |
| `close_pull_request_job` | 정상 스킵(push 이벤트라 미실행) |
| 트리거 | `git push origin main` → SWA 자동 배포 |
| 워크플로 | `.github/workflows/azure-static-web-apps-thankful-desert-0cdb08500.yml` (Azure 자동생성 정본 + 강건화) |

**이번 커밋에 담겨 배포된 변경**
- 채팅/피드백/결과(result) 화면 제거 및 관련 코드·CSS 정리
- `staticwebapp.config.json` 추가 — 보안 헤더·CSP·`assets` 장기 캐시
- 브랜드 SVG 자산(`assets/brand/`) 추가, 미사용 hero 이미지 제거
- 워크플로 빌드리스 강건화 — `skip_app_build:true`, `output_location:""`
- `config.js` 운영 백엔드 HTTPS URL로 전환
- `.gitattributes`(LF 정규화)·`CLAUDE.md`·`docs/DEPLOYMENT.md` 추가

---

## 1-A. 배포 파이프라인 사건 및 근본 해결 (2026-06-23 · dev→프로덕션 오배포)

**증상.** main 배포(18:10) 직후, 프로덕션 URL이 **main이 아닌 `dev` 브랜치 내용**을 서빙. 그 dev판 `config.js`가 백엔드를 `http://127.0.0.1:8000`으로 가리켜(+CSP `connect-src`가 localhost 불허) **전 사용자 백엔드 연결 불가 = 전량 폴백**.

**라이브 실측 증거.**

| 시점(KST) | 사건 | 증거 |
|---|---|---|
| 18:10 | main(`fa0fab7`) 배포 | Actions run `28015309951` success |
| 18:32 | dev 워크플로에 `dev` 트리거 추가 후 배포 | run `28016581530` (`ci: enable Azure SWA deploy on dev`) |
| 18:43 | dev 재배포 → **프로덕션 덮어씀** | run `28017206666`; `curl /assets/visual/hero-studio-real.png` → **200**(dev 전용 asset), `script.js` **1588줄**(=dev) |

**근본 원인.** SWA가 초기 `dev` 브랜치로 연결돼 있었고, dev 브랜치 워크플로의 `on.push.branches`에 `main`+`dev`가 함께 있었음. **단일 SWA 배포 토큰을 모든 브랜치가 공유**하므로, dev push의 워크플로 run이 `push` 이벤트로 **프로덕션 환경에 직접 업로드**(SWA deploy 액션은 push 이벤트를 항상 production으로 취급) → main을 우회해 덮어씀. dev판 콘텐츠는 팀원이 Codex 에이전트로 만든 `codex/jjirit-frontend-sync`(`3e57e90`, localhost config)에서 유입.

**근본 해결 + 재발방지 (모두 적용·검증).**

| # | 조치 | 검증 |
|---|---|---|
| R-1 | main 마지막 배포 재실행으로 **프로덕션을 main으로 복구** | `hero…png`→**404**, `script.js`→**1333줄**, `config.js`→**prod URL** 라이브 재확인 |
| R-2 | **dev 워크플로 트리거를 main 전용으로 복구**(`- dev` 제거, 커밋 `e6405ec`) | push 후 **새 배포 run 미발생**(트리거 제거된 커밋이라 dev push가 배포 안 됨), origin/dev `on:` = main-only |
| R-3 | **SWA 리소스 프로덕션 브랜치 `dev`→`main`** 정합화(`az staticwebapp update --branch main`) | `branch: main` 반환 |
| R-4 | ~~main branch protection(PR 필수·승인 1…)~~ → **2026-06-23 오너 결정으로 해제**(`protected:false`). main **직접 push 허용** | 적용 시 `require_pr=true`였으나 이후 `gh api -X DELETE …/protection` → `branch.protected:false` 확인 |
| F-3 | ✅ **적용** `config.js` **호스트 기반 가드** — 비로컬 호스트(운영/SWA 프리뷰)에서 서빙되면 어떤 사전 설정이 있어도 prod URL 강제, `localhost`/`127.0.0.1`/`file://`에서만 로컬 백엔드 허용 → 어느 브랜치가 localhost config로 배포돼도 백엔드 끊김 원천 차단(클래스 단위 재발방지) | IIFE 호스트 가드, `?v` 캐시버스터 `20260623-deploy-guard`로 갱신 |

> **재발방지 핵심 사실(팩트체크):** 이번 *dev→프로덕션 토큰 오배포*의 직접 차단은 **R-2(워크플로 트리거 main-only)+R-3(SWA 프로덕션 브랜치=main)**다. branch protection(R-4)은 *main으로의 미리뷰 직접 push*를 막는 **별개의 보완책**이었을 뿐 이 사건 벡터와 무관 — 그래서 **오너가 직접 push를 위해 R-4를 해제**해도 오배포 벡터는 R-2·R-3로 여전히 닫혀 있다(2026-06-23 실측: main·dev·codex 세 브랜치 워크플로 모두 push 트리거 main-only, SWA `branch:main`). ⚠️ 단, R-4 해제 후 main 직접 push는 **리뷰 게이트 없이 즉시 프로덕션 배포**되므로 깨진 코드 push에 주의(`config.js` 호스트 가드 F-3이 백엔드 링크 끊김만은 차단). 한편 `codex/jjirit-frontend-sync` 브랜치도 트리거 main-only라 **자체 배포 위험 없음**(방치 가능, 정리는 선택).

---

## 2. 구현 검토 — 설계 대조 (✅ 검증된 것)

배포를 실제 수행해, `DEPLOYMENT.md`의 설계가 현실과 맞는지 확인했다.

| 설계 주장 | 배포 실측 결과 | 판정 |
|---|---|---|
| 빌드리스(`skip_app_build:true`)로 Oryx 빌드 없이 업로드 | Actions 로그에서 빌드 단계 없이 업로드 성공 | ✅ 입증 |
| 산출물 B(`staticwebapp.config.json`)는 코드 변경 없이 추가만으로 동작 | 루트 추가분이 그대로 배포됨 | ✅ 입증 |
| 산출물 A(워크플로)는 Azure 자동생성본이 정본, 수동 작성 불필요 | 정본 + 강건화 2줄로 green | ✅ 입증 |
| 브랜드 자산 누락 시 로고/파비콘 404 | `assets/brand/` 동봉으로 404 회피 | ✅ 반영 |
| SWA↔GitHub 연결·시크릿 자동 구성 완료 | 시크릿명 정확 일치, 인증 통과 | ✅ 입증 |
| SWA URL이 실제 앱을 서빙 | `curl /` → **HTTP 200**, `<title>찌릿</title>`·`jjirit-logo.svg` 응답 | ✅ 검증 |
| `staticwebapp.config.json` 보안 헤더·CSP 실적용 | 응답 헤더에 `content-security-policy`(`img-src … blob:`)·`x-frame-options: DENY`·`x-content-type-options: nosniff`·`referrer-policy` 존재 | ✅ 검증 |

---

## 3. 백엔드 실연동 5계층 차단 → ✅ 어댑터로 전부 해소 (2026-06-23)

> **해소 요약(라이브 검증):** 무키 어댑터 엔드포인트 `POST /api/v1/estimate`(`azure-app-backend` `app/api/v1/adapter.py`)를 추가해 5계층을 한 번에 해소했다. 프론트는 에어컨 습관 페이로드를 그대로 보내고, 어댑터가 8개 ML 피처를 합성(기상 평년값+THI+사용량 추정)해 실제 Azure ML을 호출한다.
> - `curl POST /api/v1/estimate`(무키, Origin=SWA) → **200**, `{"predicted_kwh":152.03, …, "features_used":{8피처}}`
> - OPTIONS 프리플라이트 → `Access-Control-Allow-Origin: <SWA>` (CORS_ORIGINS에 SWA 출처 등록)
> - 프론트 production `script.js` → `/api/v1/estimate` 호출 확인, 브라우저 경로 fetch **200**(`source=live`)
> - THI 라이브값(7월 25.3°C/76.2% → 74.982214)이 역산 공식과 일치, 6월 month_sin/cos(0/-1) 일치
>
> ⚠️ **잔여 한계:** `prev_year_usage`/`current_usage`는 추정치(프론트가 실측 사용량 미수집). 정확도 향상은 `API_CONTRACT.md` §6 참조. 아래 표는 해소 전 차단 기록(이력)이다.

아래는 **해소 전** 라이브 실측 기록이다. 프론트↔백엔드 사이에 **독립적으로 각각 폴백을 유발하던 차단 지점이 5개** 있었다(하나만 고쳐선 통하지 않음).

**5계층 차단 — 라이브 실측(2026-06-23)**

| # | 계층 | 프론트(현재) | 백엔드(실측) | 증거 | 결과 |
|---|---|---|---|---|---|
| 1 | **경로** | `POST {base}/predict` (`PREDICT_ENDPOINT`) | `POST /api/v1/predict` (라우터 `prefix="/api/v1"`) | `curl POST /predict` → **404** / `/api/v1/predict` → 401 | 404 → 폴백 |
| 2 | **인증** | 헤더 없음(`Content-Type`만) | `X-API-Key` 필수(`APIKeyHeader`, 상수시간 비교) | `curl /api/v1/predict`(키 없음) → **401 `AUTH_INVALID`** | 401 → 폴백 |
| 3 | **요청 본문** | `{region, housing_type, household_size, has_aircon, aircon_hours_per_day, aircon_power_w, aircon_type}` | `{"inputs": [{8개 ML 피처}]}` + **`extra="forbid"`** | `app/schemas/prediction.py` `PredictRequest` | 422 → 폴백 |
| 4 | **응답 본문** | `predicted_kwh` 필수 — 없으면 **throw**(`normalizePredictionResponse`) | `{predictions, model_version, elapsed_ms}` (`predicted_kwh` 없음) | `app/schemas/prediction.py` `PredictResponse` | throw → 폴백 |
| 5 | **CORS** | 브라우저 프리플라이트 자동 발생 | `cors_origins` **미설정** → `Access-Control-Allow-Origin` 헤더 없음 | `curl OPTIONS /api/v1/predict`(Origin=SWA) → **500** / `GET /health`+Origin → ACAO 헤더 없음 | 브라우저 차단 → 폴백 |

> 백엔드가 기대하는 **8개 ML 피처**(`EXAMPLE_INPUT_ROW`): `prev_year_usage`, `avg_temperature`, `avg_humidity`, `total_rainfall`, `current_usage`, `thi`(불쾌지수), `month_sin`, `month_cos`.

**🔎 근본 원인 (디버깅 — 표면이 아니라 구조)**
프론트와 백엔드가 **서로 다른 계약 계층**을 말한다.
- **프론트 = "사용자 의도" 계약** — 사용자가 답할 수 있는 값(에어컨 하루 시간·타입·소비전력).
- **백엔드 = "원시 ML 피처" 계약** — 모델이 먹는 값(기온·습도·강수·THI·전년/당월 사용량·월 주기성).

이 둘 사이에 **변환 계층(adapter/BFF)이 없다.** 게다가 8개 피처는 **에어컨 시간만으로 산출 불가**(기상·사용이력 데이터가 필요)하므로, 이는 *필드 개명 수준의 불일치가 아니라* **아키텍처 결정이 필요한 갭**이다. §1차 검토(`DEPLOYMENT.md` §5)가 "불일치 2건 + 잠정 페이로드 1건"으로 본 것은 **과소평가였음**이 이번 실측으로 드러났다.

**해소 방향 (택1 — 백엔드 소유자 결정 필요)**

| 안 | 내용 | 평가 |
|---|---|---|
| **(A) 백엔드에 프론트용 어댑터 엔드포인트 추가** | 예: `POST /api/v1/predict-simple` — 입력 `{aircon_hours_per_day, aircon_type, …}`을 받아 내부에서 ML 피처로 변환·호출하고 `{predicted_kwh, estimated_bill}` 형태로 응답 | ✅ **권장.** 프론트는 경로·헤더만 맞추면 됨. 사용자 의도↔ML 피처 변환 책임을 백엔드(데이터 보유 측)에 둠 |
| (B) 프론트가 ML 피처를 직접 구성 | 프론트에서 기상·이력 데이터를 모아 8피처를 만들어 전송 | ❌ 비현실적 — 프론트엔 기상/이력 데이터 없음 |

> **폴백 불투명성 재경고:** 위 5계층이 모두 막혀도 화면은 정상으로 뜬다(`localMockPredict`). "화면이 뜬다 = 성공"이 아니다 — 콘솔 `[single-energy] Falling back…` 경고와 네트워크 응답 코드로만 실연동을 판별한다(검증 절차 §5).

---

## 4. 검토에서 발견한 후속 항목 (배포가 드러낸 것)

| # | 항목 | 근거 | §5 게이트 무관? | 권고 |
|---|---|---|---|---|
| F-1 | ✅ `actions/checkout@v3` → `@v5` 상향 **완료** | 배포 Actions annotation: *"Node.js 20 is deprecated … forced to run on Node.js 24"* | ✅ 무관 | `@v4`는 Node20 타깃이라 경고 잔존(실측) → **Node24 타깃 `@v5`로 해소** |
| F-2 | 리포트 이미지 export / CSP 회귀 검증 | `staticwebapp.config.json` CSP `img-src blob:` 적용 — 이미 배포됨 | ✅ 무관 | SWA URL에서 "이미지 저장/공유" 동작 + CSP 위반 로그 0건 확인 |

> F-1·F-2는 백엔드 실연동 게이트(§3)와 무관하므로 **지금 바로 진행 가능**한 작업이다.

---

## 5. 검증 현황 및 재발방지 스모크 점검

**항목별 검증 상태(2026-06-23 실측 갱신)**

| 항목 | 상태 | 근거 / 남은 조건 |
|---|---|---|
| SWA URL 정확성 | ✅ **검증됨** | `https://thankful-desert-0cdb08500.7.azurestaticapps.net/` → HTTP 200, 앱 서빙 확인 |
| 보안 헤더·CSP 적용(§6-10 헤더 레벨) | ✅ **검증됨** | 응답 헤더에 CSP/`X-Frame-Options`/`nosniff`/`Referrer-Policy` 존재 |
| 리포트 이미지 export 동작(§6-10 런타임) | 🟡 미검증(헤더 OK) | CSP `img-src … blob:`은 운영 응답 헤더로 재확인(2026-06-23). 남은 건 **브라우저에서** "이미지 저장/공유" 클릭 런타임 확인뿐(캔버스라 헤드리스 불가) |
| 실제 예측 200 | ✅ **검증됨**(`source=live`) | 어댑터 `POST /api/v1/estimate`(무키) → 200, 실제 ML 예측. §3에서 5계층 전부 해소. 라이브 스모크는 아래 갱신본 참조 |

**🛡️ 재발방지 — 배포 후 스모크 점검(curl, ~1분)**
프론트 폴백이 오류를 가리므로(폴백 불투명성), 배포마다 아래로 라이브 경로를 회귀 확인한다. **프론트가 실제 호출하는 무키 어댑터 `/api/v1/estimate`** 가 1차 대상이다(키 필요한 `/api/v1/predict`는 서버-서버용 보조 점검).

```bash
BE="https://app-mlbackend-prod-kc-01-h4a6byekfzhkcday.koreacentral-01.azurewebsites.net"
SWA="https://thankful-desert-0cdb08500.7.azurestaticapps.net"

curl -s -o /dev/null -w "health        %{http_code}\n" "$BE/health"             # 기대 200
# 1차: 프론트가 쓰는 무키 어댑터 — 200 + 실제 ML 예측 + ACAO 헤더가 떠야 정상
curl -s -D - -X POST "$BE/api/v1/estimate" -H "Content-Type: application/json" -H "Origin: $SWA" \
  -d '{"region":"mapo","housing_type":"oneroom","household_size":1,"has_aircon":true,"aircon_hours_per_day":4,"aircon_power_w":650,"aircon_type":"inverter"}' \
  -o /dev/null -w "estimate      %{http_code}\n" | grep -i "access-control-allow-origin"   # ACAO: <SWA> 출력돼야
# 보조: 내부 키드 엔드포인트는 키 없으면 401 유지가 정상(공개 노출 안 됨)
curl -s -o /dev/null -w "predict(nokey) %{http_code}\n" -X POST "$BE/api/v1/predict" \
  -H "Content-Type: application/json" -d '{"inputs":[{}]}'                       # 기대 401
```

| 점검 | 기대(정상) | 회귀 신호 |
|---|---|---|
| `health` | 200 | 그 외 → 백엔드 다운 |
| `estimate`(무키, Origin=SWA) | **200** + `ACAO: <SWA>` + `predicted_kwh` | 4xx/5xx 또는 ACAO 누락 → 프론트 전량 폴백 |
| `predict`(키 없음) | 401 유지 | 200이면 내부 엔드포인트가 무방비 노출(보안 회귀) |

> 브라우저 최종 확인: SWA URL 접속 → 예측 실행 → DevTools Network에서 `/api/v1/estimate` **200** + 콘솔에 `[single-energy] Falling back…` 경고 **없음**(= `source=live`).

---

## 6. 다음 작업 후보 (지시 대기)

> 백엔드도 본인 소유(`../../azure-app-backend`)이므로, 실연동은 **양쪽을 함께** 조정하면 된다(외부 팀 대기 불필요). 5계층(§3)을 **계약 먼저 → 백엔드 → 프론트 → 검증** 순으로 푼다.

| 후보 | 작업 | 선행 | 비고 |
|---|---|---|---|
| **A** | `docs/`·`README.md` 문서 최신화분 커밋 | — | push 시 무해한 .md 재배포 1회(진행 중) |
| ~~B~~ | ✅ `actions/checkout@v3 → @v5` 상향(F-1) — **완료** | — | @v4 무효 확인 후 @v5 적용·커밋 완료 |
| ~~C1~~ | ✅ `DEPLOYMENT.md` §2.1에 검증된 SWA 리소스명·호스트네임·토큰 시크릿 기입 — **완료**(2026-06-23) | — | `az staticwebapp` 실측값 반영 |
| **C2** | 브라우저 이미지 export 런타임 검증(F-2) — 🟡 잔존 | — | CSP 헤더는 통과 확인, 캔버스 클릭만 수동(헤드리스 불가) |
| ~~D0~~ | ✅ **계약 확정** — 어댑터안 채택, `API_CONTRACT.md`를 `/api/v1/estimate` 단일 계약으로 갱신 | — | **완료** |
| ~~D1~~ | ✅ **백엔드** — 무키 어댑터 `/api/v1/estimate` + 피처빌더(기상 평년값·THI·사용량 추정) + CORS_ORIGINS에 SWA 출처 등록. pytest 39개 통과, 운영 배포 `RuntimeSuccessful` | D0 | **완료** |
| ~~D2~~ | ✅ **프론트** — `PREDICT_ENDPOINT` → `/api/v1/estimate`(무키, CORS 화이트리스트로 보호). payload·응답 처리 호환 | D0·D1 | **완료**(PR #2) |
| ~~D3~~ | ✅ **검증** — `/api/v1/estimate` 라이브 200(무키)+CORS, 프론트 production이 어댑터 호출·`source=live` | D1·D2 | **완료** |

---

## 7. 참고

**내부**
- [`DEPLOYMENT.md`](./DEPLOYMENT.md) — 구현 설계서/운영 정보 (§3 워크플로, §3.1 CSP, §5 백엔드 게이트, §6 체크리스트)
- 백엔드 소스(대조 근거): `../../azure-app-backend` — `app/api/v1/predict.py`(경로·인증), `app/api/deps.py`(`X-API-Key`), `app/schemas/prediction.py`(요청/응답 스키마), `app/main.py`·`app/config.py`(CORS `cors_origins`)
- 프론트 근거: `script.js` `PREDICT_ENDPOINT`·`buildPayload()`·`normalizePredictionResponse()`
- SWA URL: `https://thankful-desert-0cdb08500.7.azurestaticapps.net/`
- 배포 Run: GitHub → Actions → Run `28014127061` / 워크플로·시크릿: `azure-static-web-apps-thankful-desert-0cdb08500.yml` / `AZURE_STATIC_WEB_APPS_API_TOKEN_THANKFUL_DESERT_0CDB08500`

**공식 문서(팩트체크 근거)**
- [CORS in FastAPI (CORSMiddleware) — FastAPI 공식](https://fastapi.tiangolo.com/tutorial/cors/)
- [Configure Azure Static Web Apps (`staticwebapp.config.json`, CSP) — Microsoft Learn](https://learn.microsoft.com/en-us/azure/static-web-apps/configuration)
- [Mixed content / `connect-src` (CSP) — MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/connect-src)
