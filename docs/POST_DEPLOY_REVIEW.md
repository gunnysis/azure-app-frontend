# 운영 배포 결과 및 구현 검토

> **대상:** `azure-app-frontend` (전기요금 예측 서비스 프론트엔드, 순수 정적 사이트)
> **배포 플랫폼:** Azure Static Web Apps (Standard)
> **검토일:** 2026-06-23
> **배포 커밋:** `fd752d4` — *운영 배포 준비: 정적 사이트 정리 + SWA 설정 추가*
> **연계 문서:** [`DEPLOYMENT.md`](./DEPLOYMENT.md) (구현 설계서/운영 정보)
> **상태:** 🟢 **정적 사이트 배포 성공** / 🟡 **백엔드 실연동 미완**(§3 게이트) — 현재 예측은 폴백으로 동작

이 문서는 2026-06-23 **실제 배포를 수행한 결과**와, 그 결과를 설계(`DEPLOYMENT.md`)와 대조한 **구현 검토**를 한 곳에 정리한다. 이후 작업은 §5(후속 항목)·§6(다음 작업 후보)을 근거로 지시받아 진행한다.

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

## 2. 구현 검토 — 설계 대조 (✅ 검증된 것)

배포를 실제 수행해, `DEPLOYMENT.md`의 설계가 현실과 맞는지 확인했다.

| 설계 주장 | 배포 실측 결과 | 판정 |
|---|---|---|
| 빌드리스(`skip_app_build:true`)로 Oryx 빌드 없이 업로드 | Actions 로그에서 빌드 단계 없이 업로드 성공 | ✅ 입증 |
| 산출물 B(`staticwebapp.config.json`)는 코드 변경 없이 추가만으로 동작 | 루트 추가분이 그대로 배포됨 | ✅ 입증 |
| 산출물 A(워크플로)는 Azure 자동생성본이 정본, 수동 작성 불필요 | 정본 + 강건화 2줄로 green | ✅ 입증 |
| 브랜드 자산 누락 시 로고/파비콘 404 | `assets/brand/` 동봉으로 404 회피 | ✅ 반영 |
| SWA↔GitHub 연결·시크릿 자동 구성 완료 | 시크릿명 정확 일치, 인증 통과 | ✅ 입증 |

---

## 3. 현재 한계 — 백엔드 실연동 미완 (출시 게이트)

정적 사이트는 배포됐지만 **예측 기능은 아직 "완전 동작"이 아니다.** 현재 예측은 프론트 내부 폴백(`localMockPredict`)으로 렌더된다.

**원인 — `DEPLOYMENT.md` §5의 미해소 항목:**

| # | 항목 | 프론트 현재 | 백엔드 기대 | 영향 |
|---|---|---|---|---|
| 1 | API 경로 불일치 | `POST {base}/predict` | `/api/v1/predict` | 404 → 폴백 |
| 2 | 인증 헤더 | 키 없음(`Content-Type`만) | `X-API-Key` 기대 | 인증 실패 가능 |
| 3 | 요청 페이로드 | `buildPayload()` 7필드(잠정) | ML 입력 스펙 미확정 | 스펙 변경 시 깨짐 |
| — | CORS | — | SWA Origin 허용 필요 | 미허용 시 차단 → 폴백 |

> **중요:** `config.js`를 운영 URL로 바꿨고 CSP `connect-src`도 운영 백엔드만 허용하지만, **위 1~3·CORS가 해소되기 전까지는 실제 200 응답을 받지 못해 폴백**한다. 겉으로는 화면이 정상으로 보이므로(폴백 불투명성), 콘솔 `[single-energy] Falling back…` 경고와 네트워크 응답 코드로만 구분 가능하다.

---

## 4. 검토에서 발견한 후속 항목 (배포가 드러낸 것)

| # | 항목 | 근거 | §5 게이트 무관? | 권고 |
|---|---|---|---|---|
| F-1 | ✅ `actions/checkout@v3` → `@v4` 상향 **완료** | 배포 Actions annotation: *"Node.js 20 is deprecated … checkout@v3 … forced to run on Node.js 24"* | ✅ 무관 | 적용·커밋 완료 |
| F-2 | 리포트 이미지 export / CSP 회귀 검증 | `staticwebapp.config.json` CSP `img-src blob:` 적용 — 이미 배포됨 | ✅ 무관 | SWA URL에서 "이미지 저장/공유" 동작 + CSP 위반 로그 0건 확인 |

> F-1·F-2는 백엔드 계약(§5)과 무관하므로 **지금 바로 진행 가능**한 작업이다.

---

## 5. 검증이 막힌 항목 — 정보 필요

| 항목 | 막힌 이유 | 필요한 것 |
|---|---|---|
| SWA URL 접속 / E2E(`DEPLOYMENT.md` §6-8~10) | SWA 기본 호스트네임을 모름 | 포털 개요의 **URL**(`https://<이름>.<region-hash>.azurestaticapps.net`) → `DEPLOYMENT.md` §2.1 채움 |
| 실제 예측 200 확인(§6-9) | §3 게이트(경로·인증·CORS) 미해소 | 백엔드 팀 합의 |

---

## 6. 다음 작업 후보 (지시 대기)

> 아래는 검토 후 지시받아 진행할 후보다. **A·B는 §3 백엔드 게이트와 무관**해 즉시 가능, **C·D는 백엔드 팀 합의에 종속**된다.

| 후보 | 작업 | 선행 | 비고 |
|---|---|---|---|
| **A** | `docs/` 문서 검토분 커밋 | — | `DEPLOYMENT.md` 갱신분 push 시 무해한 .md 재배포 1회 발생 |
| ~~B~~ | ✅ `actions/checkout@v3 → @v4` 상향(F-1) — **완료** | — | 적용·커밋 완료 |
| **C** | SWA 호스트네임으로 §2.1 채우고 E2E·이미지 export 검증 안내(F-2) | 호스트네임 제공 | F-2는 호스트네임만 있으면 가능 |
| **D** | API 경로/인증/CORS/페이로드 정합(§5-#1·#2·#3) | 백엔드 팀 합의 | 출시 게이트. 합의 후 `script.js`·`API_CONTRACT.md` 동기화 |

---

## 7. 참고

- [`DEPLOYMENT.md`](./DEPLOYMENT.md) — 구현 설계서/운영 정보 (§3 워크플로, §3.1 CSP, §5 백엔드 게이트, §6 체크리스트)
- 배포 Run: GitHub → Actions → Run `28014127061`
- 워크플로/시크릿: `azure-static-web-apps-thankful-desert-0cdb08500.yml` / `AZURE_STATIC_WEB_APPS_API_TOKEN_THANKFUL_DESERT_0CDB08500`
