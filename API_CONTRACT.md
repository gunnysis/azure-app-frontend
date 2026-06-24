# Frontend and Backend API Contract

이 문서는 프론트엔드, 백엔드, ML 팀이 같은 입력값과 응답값을 기준으로 연결하기 위한 약속입니다.

## 1. 현재 프론트가 호출하는 주소

프론트는 **어댑터 엔드포인트**를 호출합니다(에어컨 습관 → 예측). 운영:

```text
POST {API_BASE_URL}/api/v1/estimate     # 무키(API Key 불필요)
```

> 이 엔드포인트는 정적 프론트가 직접 호출하므로 **API Key를 요구하지 않습니다**(브라우저에 키를 둘 수 없음). 대신 백엔드 CORS 출처 화이트리스트 + rate limit으로 보호합니다. 8개 원시 피처를 받는 `POST /api/v1/predict`는 별도로 **`X-API-Key` 필수**(서버-서버용)입니다.

프론트 API 베이스 주소는 `config.js`에서 관리합니다(호스트 인지 가드 — 운영 호스트에선 운영 백엔드 강제, 로컬에선 `http://127.0.0.1:8000`).

## 2. 요청 JSON

> ⚠️ **잠정(provisional) 계약** — 백엔드/ML 입력 스펙 확정 시 필드가 변경될 수 있습니다. 변경 시 프론트 `buildPayload()`와 이 문서, 백엔드 스키마를 함께 갱신하세요.

프론트는 사용자가 입력한 값을 아래 형태로 보냅니다(`buildPayload()` 생성).

```json
{
  "region": "mapo",
  "housing_type": "oneroom",
  "household_size": 1,
  "has_aircon": true,
  "aircon_hours_per_day": 4,
  "aircon_power_w": 650,
  "aircon_type": "inverter"
}
```

## 3. 요청 필드 설명

| 필드 | 타입 | 예시 | 설명 |
| --- | --- | --- | --- |
| `region` | string | `"mapo"` | MVP에서는 마포구로 고정 |
| `housing_type` | string | `"oneroom"` | MVP에서는 원룸으로 고정 |
| `household_size` | number | `1` | MVP에서는 1인 가구로 고정 |
| `has_aircon` | boolean | `true` | 에어컨 사용 여부(하루 사용 시간 > 0 이면 `true`) |
| `aircon_hours_per_day` | number | `4` | 하루 에어컨 사용 시간(0~24, 0.5 단위) |
| `aircon_power_w` | number \| null \| 0 | `650` | 소비전력(W). **비우면 `null`**(평균값 사용), 미사용(0시간)이면 `0` |
| `aircon_type` | string | `"inverter"` | `"fixed"`(정속형) / `"inverter"`(인버터) / `"unknown"`(잘 모름) / `"none"`(미사용) 중 하나 |
| `month` | number \| 없음 | `7` | (선택) 예측 대상 월 1~12. **생략 시 서버 현재 월(KST)** 사용 |

## 4. 응답 JSON

실제 백엔드 응답(2026-06-24 기준):

```json
{
  "predicted_kwh": 238.0,
  "baseline_kwh": 172.0,
  "month": 7,
  "model_version": "v1",
  "elapsed_ms": 123.4,
  "features_used": {
    "prev_year_usage": 132.0, "avg_temperature": 25.3, "avg_humidity": 76.2,
    "total_rainfall": 414.4, "current_usage": 245.6, "thi": 78.1,
    "month_sin": -0.5, "month_cos": -0.866
  }
}
```

> ℹ️ **요금(`estimated_bill`/`baseline_bill`)은 백엔드가 내려주지 않습니다(설계).** 요금식을 백엔드·프론트 두 곳에 두면 드리프트가 생기므로, 백엔드는 **kWh만**(`predicted_kwh`·`baseline_kwh`) 제공하고 **요금은 프론트가 단일 요금식(`calculateElectricBill`)으로** 계산합니다. 프론트 `normalizePredictionResponse`는 응답에 `estimated_bill`이 있으면 쓰고 없으면 자체 계산하므로, 현재는 항상 자체 계산 경로입니다.

## 5. 응답 필드 설명

| 필드 | 타입 | 제공 | 설명 |
| --- | --- | --- | --- |
| `predicted_kwh` | number | ✅ 항상 | ML 모델이 예측한 이번 달 전기 사용량(프론트 필수 필드) |
| `baseline_kwh` | number \| null | ✅ (null 가능) | **계절성 기준 사용량** — 같은 월·기상에서 '에어컨 OFF' 가정의 model-based 예측. 백엔드가 같은 ML 호출에 동봉. `null`(모델이 기준 행 미반환)이면 프론트 기본값 `165kWh` 폴백 |
| `month` | number | ✅ 항상 | 예측에 사용된 월(투명성) |
| `model_version` | string \| null | ✅ | 모델 버전 |
| `elapsed_ms` | number | ✅ 항상 | ML 호출 소요(ms) |
| `features_used` | object | ✅ 항상 | 어댑터가 합성한 8개 모델 입력(디버깅용) |
| `estimated_bill` | number | ❌ 미제공 | **백엔드 미제공** — 프론트가 `predicted_kwh`로 계산(요금식 단일 소스) |
| `baseline_bill` | number | ❌ 미제공 | **백엔드 미제공** — 프론트가 `baseline_kwh`로 계산 |

> 프론트는 `predicted_kwh`(필수)와 `baseline_kwh`(비교 기준)를 사용합니다. 기준선은 이제 백엔드가 **계절성 model-based 값**으로 내려주므로(고정 165 → 월별 동적), 비교 정확도가 올라갑니다. 요금은 백엔드가 내려주지 않고 프론트 단일 요금식으로 계산합니다(드리프트 방지).

## 6. 어댑터 동작(8피처 합성)

ML 모델은 "**과거 실제 사용량 + 기상**"(8피처)을 요구하지만 프론트는 **에어컨 습관**만 수집합니다. 어댑터(`/api/v1/estimate`)가 그 간극을 메웁니다(`app/services/feature_builder.py`):

| 모델 피처 | 합성 방법 |
| --- | --- |
| `avg_temperature`·`avg_humidity`·`total_rainfall` | 마포(서울 관측소 108) **월별 기후평년값 1991-2020** 룩업 |
| `thi` | 한국 불쾌지수 `1.8T − 0.55(1−RH)(1.8T−26) + 32` (운영 예시값 역산 검증) |
| `month_sin`·`month_cos` | `sin/cos(2π·month/12)` |
| `prev_year_usage`·`current_usage` | `BASELINE(132kWh) + 에어컨 기여분` **추정**(프론트 `localMockPredict`와 정합) |

> ⚠️ **MVP 한계:** `prev_year_usage`/`current_usage`는 실측 검침값이 아니라 추정치입니다(프론트가 사용량을 묻지 않음). 정확도를 높이려면 프론트 UX에 실제 사용량 입력을 추가하거나, 에어컨 습관을 직접 입력으로 받는 모델로 교체해야 합니다.

> 🔗 **폴백 정합(동기화 의무):** API 실패 시 프론트 `localMockPredict`(→ `estimateUsageKwh`)는 위 `current_usage` 추정식을 **클라이언트에서 그대로 복제**합니다(타입별 전력·배수·실측 전력·base 132·30일·clamp 85~650·단시간 +8). 상수·산식은 백엔드 `app/services/feature_builder.py::estimate_usage`와 **1:1 일치**해야 하며, **한쪽을 바꾸면 양쪽 + 이 문서를 함께 갱신**하세요(별도 레포·무빌드라 모듈 공유 불가). 단, 폴백은 모델 *입력*만 복제하므로 라이브(ML 출력)와는 모델 보정분만큼 차이가 남습니다.

## 7. 연결 확인 방법

프론트 실행:

```bash
cd frontend
start_frontend_server.bat
```

프론트 접속:

```text
http://127.0.0.1:4202/index.html
```

브라우저 콘솔에서 현재 API 주소 확인:

```js
window.singleEnergyFrontend.getPredictEndpoint()
```

브라우저 콘솔에서 실제 요청 payload 확인:

```js
window.singleEnergyFrontend.buildPayload()
```

## 8. 현재 남은 확인 사항

배포/연동(✅ 완료 — 2026-06-23 라이브 실측):

- ✅ 백엔드 어댑터(`/api/v1/estimate`) 운영 배포 — 무키 POST → 200
- ✅ 백엔드 `CORS_ORIGINS`에 SWA 운영 출처 추가 → `Access-Control-Allow-Origin` = SWA 출처 확인
- ✅ 프론트 라이브에서 `source=live` 확인(실제 ML 예측 동작)
- ✅ **계절성 기준선(2026-06-24)** — 백엔드가 `baseline_kwh`(같은 월·기상 '에어컨 OFF' model-based 예측)를 같은 ML 호출에 동봉해 내려줌. 프론트는 이미 `baseline_kwh`를 읽으므로 비교 기준이 **고정 165 → 월별 동적**으로 자동 전환(프론트 코드 변경 불필요). `null`이면 165 폴백.
- ✅ **타임아웃 좌표 정합(2026-06-24)** — 백엔드 `/estimate`가 ML 호출에 총 예산 **6.0s**(`estimate_ml_deadline_s`)를 강제. 프론트 abort(**8s**) > 백엔드 예산(6s)이므로, 느린 ML 도 백엔드가 6s 내 504로 끊어 즉시 fallback → 프론트 8s abort 가 살아있는 백엔드를 선점하지 않음. 8s 값을 바꿀 때는 **백엔드 예산보다 크게** 유지할 것(`script.js`의 `requestPrediction` AbortController).

정확도(후속):

- `prev_year_usage`/`current_usage` 추정 한계(§6 ⚠️) — 실사용량 입력 UX 또는 모델 교체 검토
- 기상 평년값 → 실시간/해당연도 기상으로 고도화 여부(ML 팀)

장애 대응(상시):

- API 실패 시 프론트는 `localMockPredict`로 graceful fallback(콘솔 경고 + `source=fallback`)
