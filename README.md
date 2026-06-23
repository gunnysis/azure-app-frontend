# Frontend MVP

마포구 원룸 1인 가구 전기요금 예측 서비스의 프론트엔드 MVP입니다.

> 운영(라이브): **Azure Static Web Apps**에 배포되어 있습니다 — https://thankful-desert-0cdb08500.7.azurestaticapps.net/ (`main` push 시 자동 배포). 운영 백엔드 어댑터와 실연동 완료(`source=live`).

## 실행

```bash
start_frontend_server.bat                              # Windows
python -m http.server 4202 --bind 127.0.0.1            # 동등(OS 무관)
```

브라우저에서 아래 주소로 접속합니다.

```text
http://127.0.0.1:4202/index.html
```

HTML 파일을 직접 열어도 화면 확인은 가능합니다(단, `file://`에서는 백엔드 `fetch`가 동작하지 않습니다).

## 화면 흐름

1. 인트로(찌릿 스플래시)
2. 시작 안내
3. 하루 에어컨 사용 시간 · 타입 · 소비전력 입력
4. 분석 로딩
5. 리포트(예상 사용량·요금 범위·절약 미션)

## 백엔드 연동

프론트는 사용자에게 **에어컨 사용 습관만** 받고, 백엔드 **어댑터 엔드포인트**가 그 입력을 8개 ML 피처로 합성해 예측합니다(무키 — 정적 프론트가 키를 보관할 수 없어 백엔드 CORS 화이트리스트 + rate limit으로 보호).

```text
POST {API_BASE_URL}/api/v1/estimate
```

`API_BASE_URL`은 `config.js`가 호스트 인지로 결정합니다 — 운영 호스트에선 운영 백엔드 강제, 로컬에선 `http://127.0.0.1:8000`.

요청 예시(잠정 — 백엔드/ML 스펙 확정 시 변경될 수 있음):

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

응답 예시(어댑터는 `predicted_kwh`만 필수로 반환 — `estimated_bill`은 없으면 프론트가 한국 누진요금식으로 자체 계산):

```json
{
  "predicted_kwh": 238.0,
  "month": 7,
  "model_version": "v1",
  "features_used": { "thi": 78.1, "avg_temperature": 25.3, "...": "" }
}
```

백엔드가 실패(타임아웃·비2xx·네트워크)하면 프론트는 내부 휴리스틱(`localMockPredict`)으로 **자동 폴백**해 항상 화면이 뜹니다(콘솔에 폴백 경고, 결과의 `source=fallback`).

자세한 요청/응답 스펙과 어댑터의 8피처 합성은 아래 문서를 확인합니다.

```text
API_CONTRACT.md          # 프론트↔백엔드 계약(§6 어댑터 동작)
docs/DEPLOYMENT.md       # 운영 배포 런북
docs/POST_DEPLOY_REVIEW.md  # 배포 후 검증 로그
```

API 주소(로컬 개발 시)는 `config.js`에서 변경할 수 있습니다.

## 주의

예측 요금은 참고용입니다. 실제 고지서는 검침일, 누진구간, 부가세, 기후환경요금, 할인 여부에 따라 달라질 수 있습니다.
