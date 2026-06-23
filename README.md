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

1. 서비스 시작
2. 하루 평균 에어컨 사용 시간 입력
3. 선택 사항으로 에어컨 소비전력 입력
4. 분석 로딩
5. 예상 사용량과 예상 요금 리포트 확인

## 백엔드 연동

현재 프론트는 아래 주소로 예측 요청을 보냅니다.

```text
POST http://127.0.0.1:8000/predict
```

요청 예시:

```json
{
  "region": "mapo",
  "housing_type": "oneroom",
  "household_size": 1,
  "has_aircon": true,
  "aircon_hours_per_day": 4,
  "aircon_power_w": 650
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

프론트는 사용자 입력값만 정리해서 보냅니다. 전년도 사용량, 기온, 습도, 월 변수 같은 ML 피처는 백엔드/ML 파이프라인에서 붙이는 구조입니다.

에어컨 사용 시간이 0시간이면 프론트는 에어컨 없음으로 간주합니다. 이 경우 소비전력 입력은 비활성화되고, 백엔드에는 `has_aircon: false`, `aircon_power_w: null`로 전달됩니다.

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
