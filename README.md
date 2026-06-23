# Frontend MVP

마포구 원룸 1인 가구 전기요금 예측 서비스의 프론트엔드 MVP입니다.

## 실행

```bash
cd frontend
start_frontend_server.bat
```

브라우저에서 아래 주소로 접속합니다.

```text
http://127.0.0.1:4202/index.html
```

HTML 파일을 직접 열어도 화면 확인은 가능합니다.

## 화면 흐름

1. 인트로(찌릿 스플래시)
2. 시작 안내
3. 하루 에어컨 사용 시간 · 타입 · 소비전력 입력
4. 분석 로딩
5. 리포트(예상 사용량·요금 범위·절약 미션)

## 백엔드 연동

현재 프론트는 아래 주소로 예측 요청을 보냅니다.

```text
POST http://127.0.0.1:8000/predict
```

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

응답 예시:

```json
{
  "predicted_kwh": 238,
  "estimated_bill": 42200
}
```

백엔드가 실행 중이 아니면 프론트 내부 샘플 계산값으로 화면이 동작합니다.

자세한 요청/응답 스펙은 아래 문서를 확인합니다.

```text
frontend/API_CONTRACT.md
```

API 주소는 아래 파일에서 변경할 수 있습니다.

```text
frontend/config.js
```

## 주의

예측 요금은 참고용입니다. 실제 고지서는 검침일, 누진구간, 부가세, 기후환경요금, 할인 여부에 따라 달라질 수 있습니다.
