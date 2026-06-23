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

```json
{
  "predicted_kwh": 238.0,
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

## 5. 응답 필드 설명

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `predicted_kwh` | number | ML 모델이 예측한 이번 달 전기 사용량(프론트 필수 필드) |
| `month` | number | 예측에 사용된 월(투명성) |
| `model_version` | string \| null | 모델 버전 |
| `elapsed_ms` | number | ML 호출 소요(ms) |
| `features_used` | object | 어댑터가 합성한 8개 모델 입력(디버깅용) |

> 프론트는 `predicted_kwh`만 필수로 사용하며, `estimated_bill`은 응답에 없으면 `calculateElectricBill()`로 자체 계산합니다(한국 누진요금식). 백엔드는 요금 변환을 하지 않습니다.

## 6. 어댑터 동작(8피처 합성)

ML 모델은 "**과거 실제 사용량 + 기상**"(8피처)을 요구하지만 프론트는 **에어컨 습관**만 수집합니다. 어댑터(`/api/v1/estimate`)가 그 간극을 메웁니다(`app/services/feature_builder.py`):

| 모델 피처 | 합성 방법 |
| --- | --- |
| `avg_temperature`·`avg_humidity`·`total_rainfall` | 마포(서울 관측소 108) **월별 기후평년값 1991-2020** 룩업 |
| `thi` | 한국 불쾌지수 `1.8T − 0.55(1−RH)(1.8T−26) + 32` (운영 예시값 역산 검증) |
| `month_sin`·`month_cos` | `sin/cos(2π·month/12)` |
| `prev_year_usage`·`current_usage` | `BASELINE(132kWh) + 에어컨 기여분` **추정**(프론트 `localMockPredict`와 정합) |

> ⚠️ **MVP 한계:** `prev_year_usage`/`current_usage`는 실측 검침값이 아니라 추정치입니다(프론트가 사용량을 묻지 않음). 정확도를 높이려면 프론트 UX에 실제 사용량 입력을 추가하거나, 에어컨 습관을 직접 입력으로 받는 모델로 교체해야 합니다.

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

정확도(후속):

- `prev_year_usage`/`current_usage` 추정 한계(§6 ⚠️) — 실사용량 입력 UX 또는 모델 교체 검토
- 기상 평년값 → 실시간/해당연도 기상으로 고도화 여부(ML 팀)

장애 대응(상시):

- API 실패 시 프론트는 `localMockPredict`로 graceful fallback(콘솔 경고 + `source=fallback`)
