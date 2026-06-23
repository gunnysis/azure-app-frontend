# Frontend and Backend API Contract

이 문서는 프론트엔드, 백엔드, ML 팀이 같은 입력값과 응답값을 기준으로 연결하기 위한 약속입니다.

## 1. 현재 프론트가 호출하는 주소

로컬 개발 기본값:

```text
POST http://127.0.0.1:8000/predict
```

프론트 API 주소는 `frontend/config.js`에서 바꿀 수 있습니다.

```js
window.SINGLE_ENERGY_API_BASE_URL = "http://127.0.0.1:8000";
```

Azure App Service 배포 후에는 예를 들어 아래처럼 바꾸면 됩니다.

```js
window.SINGLE_ENERGY_API_BASE_URL = "https://서비스이름.azurewebsites.net";
```

## 2. 요청 JSON

프론트는 사용자가 입력한 값을 아래 형태로 보냅니다.

```json
{
  "area_m2": 29.8,
  "pyeong": 9,
  "region": "mapo",
  "housing_type": "oneroom",
  "household_size": 1,
  "has_aircon": true,
  "heating_type": "electric",
  "has_induction": true
}
```

## 3. 요청 필드 설명

| 필드 | 타입 | 예시 | 설명 |
| --- | --- | --- | --- |
| `area_m2` | number | `29.8` | 프론트가 평수를 제곱미터로 변환한 값 |
| `pyeong` | number | `9` | 사용자가 입력한 평수 |
| `region` | string | `"mapo"` | MVP에서는 마포구로 고정 |
| `housing_type` | string | `"oneroom"` | MVP에서는 원룸으로 고정 |
| `household_size` | number | `1` | MVP에서는 1인 가구로 고정 |
| `has_aircon` | boolean | `true` | 에어컨 보유 여부 |
| `heating_type` | string | `"electric"` | `"electric"`, `"gas"`, `"district"` 중 하나 |
| `has_induction` | boolean | `true` | 인덕션 사용 여부 |

## 4. 필수 응답 JSON

백엔드는 최소 아래 두 값을 반환해야 합니다.

```json
{
  "predicted_kwh": 238,
  "estimated_bill": 42200
}
```

## 5. 응답 필드 설명

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `predicted_kwh` | number | ML 모델이 예측한 이번 달 전기 사용량 |
| `estimated_bill` | number | 백엔드가 `predicted_kwh`를 전기요금으로 변환한 값 |

`estimated_bill`이 없으면 프론트가 임시 요금 계산식으로 표시할 수 있지만, 최종 MVP에서는 백엔드에서 계산해서 주는 편이 좋습니다.

## 6. 백엔드 Mock 예시

ML 모델이 아직 완성되지 않아도 백엔드는 먼저 mock API를 열 수 있습니다.

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:4202",
        "http://localhost:4202",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class PredictRequest(BaseModel):
    area_m2: float
    pyeong: float
    region: str
    housing_type: str
    household_size: int
    has_aircon: bool
    heating_type: str
    has_induction: bool

@app.post("/predict")
def predict(data: PredictRequest):
    return {
        "predicted_kwh": 238,
        "estimated_bill": 42200,
    }
```

실행:

```bash
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

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

ML 팀 확인 필요:

- 최종 모델 입력 컬럼이 프론트 요청 필드와 같은지
- 모델이 직접 받는 컬럼명과 타입
- `model.pkl`을 백엔드에서 호출할 때 필요한 전처리 방식

백엔드 팀 확인 필요:

- `/predict` mock API 먼저 오픈
- CORS 설정
- `predicted_kwh`, `estimated_bill` 응답 보장
- mock 응답을 실제 ML 모델 응답으로 교체

프론트 팀 확인 필요:

- mock API 연결 테스트
- 실제 API 연결 후 결과 화면 확인
- API 실패 시 콘솔 경고와 화면 fallback 확인
