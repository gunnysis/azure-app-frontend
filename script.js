const BASELINE_KWH = 165;
const BASELINE_BILL = calculateElectricBill(BASELINE_KWH);
const BILL_RANGE_MARGIN = 5000;
const AIRCON_TYPE_LABELS = {
  fixed: "정속형",
  inverter: "인버터",
  unknown: "잘 모름",
  none: "미사용",
};
const API_BASE_URL = (
  window.SINGLE_ENERGY_API_BASE_URL || "http://127.0.0.1:8000"
).replace(/\/$/, "");
const PREDICT_ENDPOINT = `${API_BASE_URL}/api/v1/estimate`;
const CHAT_ENDPOINT = window.SINGLE_ENERGY_CHAT_API_URL || "/api/chat";

const screens = [
  { id: "splash", label: "인트로", cta: "시작하기" },
  { id: "start", label: "안내", cta: "다음" },
  { id: "airconTime", label: "사용 시간", cta: "예상 요금 보기" },
  { id: "loading", label: "분석", cta: "계산 중" },
  { id: "report", label: "리포트", cta: "처음으로 돌아가기" },
];

const state = {
  index: 0,
  airconHours: 4,
  airconPowerW: null,
  airconType: "unknown",
  lastPrediction: null,
  timers: [],
  hintTimer: null,
  chatMessages: [],
  airconTimeTouched: false,
  referenceInputTouched: false,
};

const els = {
  themeButton: document.querySelector("#themeButton"),
  progressBar: document.querySelector("#progressBar"),
  stepLabel: document.querySelector("#stepLabel"),
  stepCount: document.querySelector("#stepCount"),
  screens: [...document.querySelectorAll(".screen")],
  backButton: document.querySelector("#backButton"),
  nextButton: document.querySelector("#nextButton"),
  airconHoursInput: document.querySelector("#airconHoursInput"),
  airconHoursRange: document.querySelector("#airconHoursRange"),
  airconTimeHint: document.querySelector("#airconTimeHint"),
  airconTypeBlock: document.querySelector("#airconTypeBlock"),
  airconTypeButtons: [...document.querySelectorAll("[data-aircon-type]")],
  airconPowerInput: document.querySelector("#airconPowerInput"),
  airconPowerHint: document.querySelector("#airconPowerHint"),
  loadingTitle: document.querySelector("#loadingTitle"),
  loadingCopy: document.querySelector("#loadingCopy"),
  loadingSteps: [...document.querySelectorAll("[data-loading-step]")],
  shareReportCard: document.querySelector("#shareReportCard"),
  reportRiskPill: document.querySelector("#reportRiskPill"),
  reportTypeName: document.querySelector("#reportTypeName"),
  reportOneLine: document.querySelector("#reportOneLine"),
  reportVisual: document.querySelector("#reportVisual"),
  reportJjiritImg: document.querySelector("#reportJjiritImg"),
  reportCharacterMood: document.querySelector("#reportCharacterMood"),
  shareBill: document.querySelector("#shareBill"),
  shareKwh: document.querySelector("#shareKwh"),
  shareGapText: document.querySelector("#shareGapText"),
  shareBaselineBar: document.querySelector("#shareBaselineBar"),
  shareMineBar: document.querySelector("#shareMineBar"),
  shareBaselineBill: document.querySelector("#shareBaselineBill"),
  shareMineBill: document.querySelector("#shareMineBill"),
  reasonIcon: document.querySelector("#reasonIcon"),
  shareReason: document.querySelector("#shareReason"),
  missionVisual: document.querySelector("#missionVisual"),
  shareMission: document.querySelector("#shareMission"),
  shareMissionCopy: document.querySelector("#shareMissionCopy"),
  saveImageButton: document.querySelector("#saveImageButton"),
  shareImageButton: document.querySelector("#shareImageButton"),
  resetReportButton: document.querySelector("#resetReportButton"),
  shareStatus: document.querySelector("#shareStatus"),
  tipList: document.querySelector("#tipList"),
  summaryAirconHours: document.querySelector("#summaryAirconHours"),
  contactBotButton: document.querySelector("#contactBotButton"),
  contactBotPanel: document.querySelector("#contactBotPanel"),
  contactCloseButton: document.querySelector("#contactCloseButton"),
  chatMessages: document.querySelector("#chatMessages"),
  chatForm: document.querySelector("#chatForm"),
  chatInput: document.querySelector("#chatInput"),
  demoQuestionButtons: [...document.querySelectorAll("[data-demo-question]")],
  feedbackForm: document.querySelector("#feedbackForm"),
  feedbackInput: document.querySelector("#feedbackInput"),
  feedbackStatus: document.querySelector("#feedbackStatus"),
};

function numberOnly(value) {
  return Number(String(value).replace(/[^\d.]/g, "")) || 0;
}

function formatNumber(value) {
  return Math.round(value).toLocaleString("ko-KR");
}

function floorWon(value) {
  return Math.floor(Math.max(0, value) / 100) * 100;
}

function roundDisplayWon(value) {
  return Math.round(Math.max(0, value) / 1000) * 1000;
}

function formatWonRange(value, margin = BILL_RANGE_MARGIN) {
  const amount = roundDisplayWon(value);
  const lower = roundDisplayWon(amount - margin);
  const upper = roundDisplayWon(amount + margin);
  return `${formatNumber(lower)} ~ ${formatNumber(upper)}원`;
}

function formatBillRange(value) {
  return formatWonRange(value, BILL_RANGE_MARGIN);
}

function formatGapRange(value) {
  return formatWonRange(value, BILL_RANGE_MARGIN);
}

function formatSignedKwh(value) {
  const rounded = Math.round(value);
  if (rounded > 0) return `+${formatNumber(rounded)}kWh`;
  if (rounded < 0) return `-${formatNumber(Math.abs(rounded))}kWh`;
  return "0kWh";
}

function formatHours(value) {
  return Number.isInteger(value) ? formatNumber(value) : value.toFixed(1);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function delay(ms) {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    state.timers.push(timer);
  });
}

function clearTimers() {
  state.timers.forEach((timer) => clearTimeout(timer));
  state.timers = [];
  if (state.hintTimer) {
    clearTimeout(state.hintTimer);
    state.hintTimer = null;
  }
}

function calculateElectricBill(kwh) {
  const usage = Math.max(0, Math.round(kwh));
  let energy = 0;
  let basic = 910;

  if (usage <= 200) {
    energy = usage * 120;
    basic = 910;
  } else if (usage <= 400) {
    energy = 200 * 120 + (usage - 200) * 214.6;
    basic = 1600;
  } else {
    energy = 200 * 120 + 200 * 214.6 + (usage - 400) * 307.3;
    basic = 7300;
  }

  const climate = usage * 9;
  const fuel = usage * 5;
  const subtotal = basic + energy + climate + fuel;
  const vat = subtotal * 0.1;
  const fund = subtotal * 0.037;
  return floorWon(subtotal + vat + fund);
}

function getAirconHours() {
  return clamp(numberOnly(els.airconHoursInput.value), 0, 24);
}

function hasAirconUsage() {
  return getAirconHours() > 0;
}

function normalizeAirconHoursInput() {
  const value = getAirconHours();
  els.airconHoursInput.value = Number.isInteger(value) ? String(value) : value.toFixed(1);
  els.airconHoursRange.value = String(value);
  state.airconHours = value;
}

function getAirconPowerW() {
  if (!hasAirconUsage()) return 0;
  const value = numberOnly(els.airconPowerInput?.value ?? "");
  if (!value) return null;
  return Math.round(clamp(value, 1, 5000));
}

function getAirconType() {
  return hasAirconUsage() ? state.airconType || "unknown" : "none";
}

function renderAirconTypeButtons() {
  const selected = getAirconType();
  els.airconTypeButtons.forEach((button) => {
    const active = button.dataset.airconType === selected;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function normalizeAirconPowerInput({ writeValue = true } = {}) {
  const value = getAirconPowerW();
  state.airconPowerW = value;
  if (els.airconPowerInput && hasAirconUsage() && value !== null && writeValue) {
    els.airconPowerInput.value = String(value);
  }
  renderAirconPowerHint();
}

function syncAirconPowerState() {
  const disabled = !hasAirconUsage();
  const container = els.airconPowerInput?.closest(".aircon-reference-card");
  const typeBlock = els.airconTypeBlock;
  if (els.airconPowerInput) {
    els.airconPowerInput.disabled = disabled;
    els.airconPowerInput.setAttribute("aria-disabled", String(disabled));
  }
  if (container) {
    container.hidden = disabled;
  }
  if (typeBlock) {
    typeBlock.hidden = disabled;
  }
  container?.classList.toggle("is-disabled", disabled);
  container?.setAttribute("aria-disabled", String(disabled));
  if (disabled) {
    state.airconPowerW = 0;
    state.airconType = "none";
    state.referenceInputTouched = false;
    if (typeBlock) typeBlock.open = false;
  } else if (state.airconType === "none") {
    state.airconType = "unknown";
  }
  renderAirconTypeButtons();
  renderAirconPowerHint();
}

function setAirconHoursValue(value, shouldRender = true) {
  const nextValue = clamp(Number(value) || 0, 0, 24);
  els.airconHoursInput.value = Number.isInteger(nextValue) ? String(nextValue) : nextValue.toFixed(1);
  els.airconHoursRange.value = String(nextValue);
  state.airconHours = nextValue;
  if (shouldRender) {
    scheduleAirconTimeHint();
    syncAirconPowerState();
    // report 스크린은 airconTime 단계에서 숨겨져 있고, 실제 렌더는 runLoading()에서
    // 예측 결과로 한 번에 수행한다. 드래그 틱마다 숨은 화면을 재렌더하지 않는다(성능).
  }
}

function getAirconHoursFromClientX(clientX) {
  const rect = els.airconHoursRange.getBoundingClientRect();
  const ratio = rect.width ? clamp((clientX - rect.left) / rect.width, 0, 1) : 0;
  return Math.round((ratio * 24) / 0.5) * 0.5;
}

function updateAirconHoursFromClientX(clientX) {
  if (els.airconHoursRange.disabled) return;
  state.airconTimeTouched = true;
  setAirconHoursValue(getAirconHoursFromClientX(clientX));
}

function getAirconIntensityColor(hours) {
  if (hours <= 1) return "#00a86b";
  if (hours <= 6) return "#3182f6";
  if (hours <= 12) return "#f59e0b";
  return "#ef4444";
}

function buildPayload() {
  const airconHours = getAirconHours();
  const hasAircon = airconHours > 0;
  const airconPowerW = hasAircon ? getAirconPowerW() : 0;
  const airconType = hasAircon ? getAirconType() : "none";
  return {
    region: "mapo",
    housing_type: "oneroom",
    household_size: 1,
    has_aircon: hasAircon,
    aircon_hours_per_day: airconHours,
    aircon_power_w: airconPowerW,
    aircon_type: airconType,
  };
}

// ⚠️ 동기화 필수: 아래 상수·산식은 백엔드 azure-app-backend
//   app/services/feature_builder.py(estimate_usage)와 1:1 일치해야 한다.
//   한쪽을 바꾸면 반드시 다른 쪽도 함께 바꿀 것 — 그래야 폴백(localMockPredict)과
//   라이브(/api/v1/estimate) 예측 kWh가 같은 입력에 같은 값을 낸다.
//   별도 레포·무빌드라 모듈 공유가 불가하므로 이 주석이 유일한 정합 계약이다.
const USAGE_BASE_MONTHLY_KWH = 132; // 에어컨 외 기저 사용량(원룸 1인)
const USAGE_DAYS_PER_MONTH = 30;
const USAGE_TYPE_DEFAULT_POWER_W = { fixed: 760, inverter: 560, unknown: 650, none: 0 };
const USAGE_TYPE_MULTIPLIER = { fixed: 1.1, inverter: 0.92, unknown: 1.0, none: 0.0 };
const USAGE_FALLBACK_POWER_W = 650;
const USAGE_MIN_KWH = 85;
const USAGE_MAX_KWH = 650;
const SHORT_RUN_BONUS_KWH = 8; // 0<h≤1 단시간 가동의 고정 점화/대기 비용
// 발견 C 대응(백엔드 정합): 모델은 current_usage를 라벨로 무시 → 백엔드가 에어컨 신호를
// prev_year_usage 로 라우팅. 폴백은 그 모델 반응대역을 오프라인 근사한다.
const USAGE_DUTY_CYCLE = 0.6; // 압축기 평균 가동률. 백엔드 AIRCON_DUTY_CYCLE와 동일.
const MODEL_PREV_MAX_KWH = 400; // 폴백 표시 상한(라이브 모델 반응 상한 미러). 백엔드 MODEL_PREV_MAX_KWH와 동일.

// 에어컨 가동의 월 기여 kWh(비례분). base/단시간보정/clamp 제외 — 예측(estimateUsageKwh)과
// 절감 팁(getTipCandidates)이 공유하는 단일 전력 모델(중복·드리프트 차단).
// 연산자 주의(백엔드 Python 정합):
//   - 타입 기본전력/배수 룩업은 ??(미지 키만 폴백) — none:0 을 0으로 보존해야 함(||금지).
//   - 전력 우선순위는 ||(실측 power 가 null/0 이면 기본전력 → 그것도 0이면 폴백) = Python `or`.
function airconMarginalKwh(hours, payload) {
  const type = payload.aircon_type || "unknown";
  const defaultPower = USAGE_TYPE_DEFAULT_POWER_W[type] ?? USAGE_FALLBACK_POWER_W;
  const powerW = payload.aircon_power_w || defaultPower || USAGE_FALLBACK_POWER_W;
  const multiplier = USAGE_TYPE_MULTIPLIER[type] ?? 1.0;
  return hours * USAGE_DAYS_PER_MONTH * (powerW / 1000) * multiplier * USAGE_DUTY_CYCLE;
}

// 백엔드 estimate_usage 의 current(올해 사용량 추정) 산식 포팅.
function estimateUsageKwh(payload) {
  const hours = payload.aircon_hours_per_day || 0;
  let airconKwh = airconMarginalKwh(hours, payload);
  if (hours > 0 && hours <= 1) airconKwh += SHORT_RUN_BONUS_KWH;
  return clamp(USAGE_BASE_MONTHLY_KWH + airconKwh, USAGE_MIN_KWH, USAGE_MAX_KWH);
}

function localMockPredict(payload) {
  // 폴백 예측 = 백엔드 추정식(current)을 복제하되, 라이브 모델이 prev_year_usage 를 ~400 에서
  // 포화시키므로 같은 상한(MODEL_PREV_MAX_KWH)으로 근사한다(잔차=모델 압축분, graceful 허용).
  // baseline 은 백엔드의 model-based 계절값을 오프라인 복제할 수 없어 165 고정 유지(설계 범위 밖).
  const predictedKwh = Math.round(Math.min(estimateUsageKwh(payload), MODEL_PREV_MAX_KWH));
  return {
    predicted_kwh: predictedKwh,
    estimated_bill: calculateElectricBill(predictedKwh),
    baseline_kwh: BASELINE_KWH,
    baseline_bill: BASELINE_BILL,
    source: "sample",
  };
}

function normalizePredictionResponse(data) {
  const predicted = Number(data.predicted_kwh ?? data.expected_kwh ?? data.kwh);
  if (!Number.isFinite(predicted) || predicted <= 0) {
    throw new Error("Invalid prediction response: predicted_kwh is required");
  }

  const bill = Number(data.estimated_bill ?? data.bill ?? data.estimated_won);
  const baselineKwh = Number(data.baseline_kwh ?? data.baseline_usage_kwh ?? data.average_kwh);
  const baselineBill = Number(data.baseline_bill ?? data.baseline_estimated_bill ?? data.average_bill);
  return {
    predicted_kwh: predicted,
    estimated_bill: Number.isFinite(bill) && bill > 0 ? bill : calculateElectricBill(predicted),
    baseline_kwh: Number.isFinite(baselineKwh) && baselineKwh > 0 ? baselineKwh : BASELINE_KWH,
    baseline_bill: Number.isFinite(baselineBill) && baselineBill > 0
      ? baselineBill
      : calculateElectricBill(Number.isFinite(baselineKwh) && baselineKwh > 0 ? baselineKwh : BASELINE_KWH),
    source: "live",
    raw: data,
  };
}

async function requestPrediction(payload) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(PREDICT_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error("request failed");
    const data = await response.json();
    return normalizePredictionResponse(data);
  } catch (error) {
    console.warn("[single-energy] Falling back to local sample prediction.", {
      endpoint: PREDICT_ENDPOINT,
      reason: error.message,
    });
    return {
      ...localMockPredict(payload),
      source: "fallback",
      error: error.message,
    };
  } finally {
    clearTimeout(timer);
  }
}

function getRisk(kwh, baselineKwh = BASELINE_KWH) {
  const gap = kwh - baselineKwh;
  if (gap >= 85) return { label: "위험", color: "#ef4444", text: "마포구 1인 가구 기준보다 꽤 높아요." };
  if (gap >= 20) return { label: "주의", color: "#f59e0b", text: "마포구 1인 가구 기준보다 조금 높아요." };
  return { label: "안정", color: "#00a86b", text: "마포구 1인 가구 기준과 비슷해요." };
}

function getReportProfile(payload, prediction, baselineKwh = BASELINE_KWH) {
  const gap = prediction.predicted_kwh - baselineKwh;
  const hours = payload.aircon_hours_per_day;

  if (gap >= 85) {
    return {
      key: "alert",
      typeName: "전기세 빨간불형",
      oneLine: "이번 달은 주의가 필요해요.",
      visual: ["🚨", "₩"],
      mood: "위험 감지",
      character: "./assets/brand/characters/jjirit-alert.png",
      reasonIcon: "!",
      reason: "하루 사용 시간이 한 달치로 누적되면서 마포구 1인 가구 기준과의 차이가 크게 벌어졌어요.",
    };
  }

  if (hours === 0) {
    return {
      key: "steady",
      typeName: "찌릿 안심형",
      oneLine: "이번 달은 안심 구간에 가까워요.",
      visual: ["💡", "✓"],
      mood: "안심 신호",
      character: "./assets/brand/characters/jjirit-steady.png",
      reasonIcon: "✓",
      reason: "냉방 사용 시간이 0시간이라 기본 생활 전력 중심으로 계산했어요.",
    };
  }

  if (hours <= 2) {
    return {
      key: "steady",
      typeName: "절약 성공형",
      oneLine: "이번 달은 꽤 잘 버티고 있어요.",
      visual: ["✨", "✓"],
      mood: "절약 성공",
      character: "./assets/brand/characters/jjirit-saving.png",
      reasonIcon: "✓",
      reason: `하루 ${formatHours(hours)}시간 사용은 월 기준으로 봐도 기준 구간 안쪽에 가깝게 잡혀요.`,
    };
  }

  if (hours >= 8) {
    return {
      key: "cooling",
      typeName: "냉방 찌릿형",
      oneLine: "시원함은 챙겼고, 전기세는 눈치 봐야 해요.",
      visual: ["❄️", "₩"],
      mood: "냉방 체크",
      character: "./assets/brand/characters/jjirit-basic.png",
      reasonIcon: "↗",
      reason: `하루 ${formatHours(hours)}시간은 월 ${formatNumber(hours * 30)}시간으로 쌓여요. 이 누적 시간이 기준 대비 차이를 크게 만들었어요.`,
    };
  }

  if (hours >= 4) {
    return {
      key: "cooling",
      typeName: "찌릿 주의형",
      oneLine: "전기세가 슬슬 신호를 보내고 있어요.",
      visual: ["❄️", "₩"],
      mood: "주의 신호",
      character: "./assets/brand/characters/jjirit-basic.png",
      reasonIcon: "↗",
      reason: `하루 ${formatHours(hours)}시간이 매일 반복되면 월 사용량이 기준 구간을 넘기 쉬워요.`,
    };
  }

  return {
    key: "cooling",
    typeName: "가끔 찌릿형",
    oneLine: "아직은 부담이 크지 않은 냉방 패턴이에요.",
    visual: ["🌬️", "✓"],
    mood: "가끔 찌릿",
    character: "./assets/brand/characters/jjirit-basic.png",
    reasonIcon: "↗",
    reason: `사용 시간이 짧아 월 누적 전력 부담은 아직 크게 튀지 않는 편이에요.`,
  };
}

function getTipCandidates(payload, prediction) {
  const before = prediction.estimated_bill;
  const candidates = [];
  const hours = payload.aircon_hours_per_day;

  if (hours > 0) {
    const reducedHours = hours >= 1 ? 1 : 0.5;
    // 예측과 동일한 전력 모델(타입별 전력·배수) 사용 — 절감량이 예측 변화와 일관.
    const savingKwh = Math.max(4, Math.round(airconMarginalKwh(reducedHours, payload)));
    candidates.push({
      icon: "❄️",
      title: `에어컨 하루 ${formatHours(reducedHours)}시간 덜 켜기`,
      detail: "잠들기 전 예약 종료만 걸어도 한 달 요금이 꽤 가벼워져요.",
      kwh: savingKwh,
      quantified: true,
    });

    candidates.push({
      icon: "⏱️",
      title: "취침 전 예약 종료",
      detail: "자는 동안 계속 켜지는 시간을 막으면 냉방 전력을 줄일 수 있어요.",
      kwh: Math.max(5, Math.round(hours * 4)),
      quantified: true,
    });

    candidates.push({
      icon: "🌬️",
      title: "선풍기와 같이 쓰기",
      detail: "같은 체감온도에서도 설정 온도를 조금 높일 수 있어요.",
      kwh: Math.max(4, Math.round(hours * 3)),
      quantified: true,
    });
  }

  candidates.push({
    icon: "🧊",
    title: "냉장고 문 오래 열지 않기",
    detail: "기본 가전에 포함되는 항목이라 생활 습관 점검용으로 보여줘요.",
    tag: "기본 가전 점검",
    quantified: false,
  });

  candidates.push({
    icon: "💨",
    title: "헤어드라이기 사용 시간 줄이기",
    detail: "짧게 자주 쓰는 가전이라 사용 습관만 기록해도 다음 분석에 도움돼요.",
    tag: "사용 습관 체크",
    quantified: false,
  });

  return candidates
    .map((item) => {
      if (!item.quantified) return { ...item, saving: null };
      const afterBill = calculateElectricBill(Math.max(0, prediction.predicted_kwh - item.kwh));
      return { ...item, saving: Math.max(300, before - afterBill) };
    })
    .sort((a, b) => {
      if (a.quantified !== b.quantified) return a.quantified ? -1 : 1;
      return (b.saving || 0) - (a.saving || 0);
    })
    .slice(0, 3);
}

// 슬라이더의 진행률/색상 CSS 변수를 현재 사용 시간에 맞춰 갱신하고 시간을 반환한다.
function applyAirconRangeVisual() {
  const hours = getAirconHours();
  const percent = clamp((hours / 24) * 100, 0, 100);
  const color = getAirconIntensityColor(hours);
  const card = els.airconHoursRange.closest(".aircon-time-card");
  els.airconHoursRange.value = String(hours);
  els.airconHoursRange.style.setProperty("--range-progress", `${percent}%`);
  els.airconHoursRange.style.setProperty("--range-color", color);
  els.airconHoursRange.style.setProperty("--range-soft", `${color}22`);
  card?.style.setProperty("--time-color", color);
  return hours;
}

function renderAirconTimeHint() {
  const hours = applyAirconRangeVisual();

  if (!state.airconTimeTouched) {
    els.airconTimeHint.hidden = true;
    els.airconTimeHint.textContent = "";
    els.airconTimeHint.classList.remove("is-pending");
    return;
  }

  els.airconTimeHint.hidden = false;
  els.airconTimeHint.textContent =
    hours === 0
      ? "0시간은 에어컨 미사용 기준으로 계산해요."
      : `${formatHours(hours)}시간/일 · 월 ${formatNumber(hours * 30)}시간 기준`;
  els.airconTimeHint.classList.remove("is-pending");
}

function scheduleAirconTimeHint() {
  const hours = applyAirconRangeVisual();

  if (!state.airconTimeTouched) {
    renderAirconTimeHint();
    return;
  }

  if (state.hintTimer) clearTimeout(state.hintTimer);
  els.airconTimeHint.hidden = false;
  els.airconTimeHint.classList.add("is-pending");
  els.airconTimeHint.textContent =
    hours === 0
      ? "에어컨을 쓰지 않는 조건으로 계산할게요."
      : "선택한 시간으로 월 기준을 맞추고 있어요.";
  state.hintTimer = setTimeout(() => {
    state.hintTimer = null;
    renderAirconTimeHint();
  }, 760);
}

function renderAirconPowerHint() {
  if (!els.airconPowerHint) return;
  if (!hasAirconUsage()) {
    els.airconPowerHint.hidden = true;
    els.airconPowerHint.textContent = "";
    return;
  }
  if (!state.referenceInputTouched) {
    els.airconPowerHint.hidden = true;
    els.airconPowerHint.textContent = "";
    return;
  }
  els.airconPowerHint.hidden = false;
  els.airconPowerHint.textContent = "참고용 입력이에요. 현재 예측은 사용 시간을 중심으로 계산해요.";
}

function formatTipBadge(tip) {
  if (!tip.quantified) return tip.tag || "습관 체크";
  return "예측 반영";
}

function renderTips(tips) {
  els.tipList.innerHTML = tips
    .map(
      (tip) => `
        <article class="tip-card">
          <b>${tip.icon}</b>
          <div>
            <strong>${tip.title}</strong>
            <p>${tip.detail}</p>
          </div>
          <span>${formatTipBadge(tip)}</span>
        </article>
      `,
    )
    .join("");
}

function setAirconType(type) {
  if (!hasAirconUsage()) {
    state.airconType = "none";
    state.referenceInputTouched = false;
    renderAirconTypeButtons();
    renderAirconPowerHint();
    return;
  }
  state.airconType = AIRCON_TYPE_LABELS[type] ? type : "unknown";
  state.referenceInputTouched = true;
  renderAirconTypeButtons();
  renderAirconPowerHint();
}

function renderPrediction(prediction = state.lastPrediction) {
  const payload = buildPayload();
  const result = prediction || localMockPredict(payload);
  const baselineKwh = Number(result.baseline_kwh) > 0 ? Number(result.baseline_kwh) : BASELINE_KWH;
  const baselineBill = Number(result.baseline_bill) > 0 ? Number(result.baseline_bill) : calculateElectricBill(baselineKwh);
  const risk = getRisk(result.predicted_kwh, baselineKwh);
  const usageGap = Math.round(result.predicted_kwh - baselineKwh);
  const billGap = Math.round(result.estimated_bill - baselineBill);
  const tips = getTipCandidates(payload, result);
  const topTip = tips[0];
  const profile = getReportProfile(payload, result, baselineKwh);
  const billMax = Math.max(result.estimated_bill, baselineBill, 1);

  els.shareReportCard.dataset.profile = profile.key;
  els.shareReportCard.style.setProperty("--profile", risk.color);
  els.reportRiskPill.textContent = risk.label;
  els.reportRiskPill.style.color = risk.color;
  els.reportRiskPill.style.background = `${risk.color}1f`;
  els.reportTypeName.textContent = profile.typeName;
  els.reportOneLine.textContent = profile.oneLine;
  els.reportVisual.querySelector(".visual-main").textContent = profile.visual[0];
  els.reportVisual.querySelector(".visual-sub").textContent = profile.visual[1];
  if (els.reportJjiritImg) {
    els.reportJjiritImg.src = profile.character;
  }
  if (els.reportCharacterMood) {
    els.reportCharacterMood.textContent = profile.mood;
  }
  els.shareBill.textContent = formatBillRange(result.estimated_bill);
  els.shareKwh.textContent = `${formatNumber(result.predicted_kwh)}kWh`;
  els.shareGapText.textContent =
    billGap >= 0
      ? `기준보다 ${formatGapRange(Math.abs(billGap))} 높게 예측됐어요`
      : `기준보다 ${formatGapRange(Math.abs(billGap))} 낮게 예측됐어요`;
  els.shareBaselineBill.textContent = formatBillRange(baselineBill);
  els.shareMineBill.textContent = formatBillRange(result.estimated_bill);
  els.shareBaselineBar.style.width = `${clamp((baselineBill / billMax) * 100, 24, 100)}%`;
  els.shareMineBar.style.width = `${clamp((result.estimated_bill / billMax) * 100, 24, 100)}%`;
  els.reasonIcon.textContent = profile.reasonIcon;
  els.shareReason.textContent = usageGap > 0 ? profile.reason : "현재 조건은 기준과 비슷하지만, 작은 습관을 줄이면 다음 달 요금을 더 낮출 수 있어요.";
  els.missionVisual.querySelector("span").textContent = topTip.icon === "❄️" ? "☕" : topTip.icon;
  els.shareMission.textContent = topTip.title;
  els.shareMissionCopy.textContent = topTip.quantified
    ? "예측에 직접 반영되는 조정 항목이에요."
    : (topTip.tag || "습관 체크");
  renderTips(tips);

  els.summaryAirconHours.textContent = `${formatHours(payload.aircon_hours_per_day)}시간`;
}

function setLoadingStep(step) {
  const titles = [
    "사용자 응답을\n확인하고 있어요",
    "입력값을\n분석하고 있어요",
    "마포구 1인 가구 기준과\n비교하고 있어요",
    "리포트를\n준비하고 있어요",
  ];
  const title = titles[Math.min(step, titles.length - 1)];
  els.loadingTitle.innerHTML = title.replace(/\n/g, "<br />");
  if (els.loadingCopy) {
    els.loadingCopy.hidden = true;
    els.loadingCopy.textContent = "";
  }
  els.loadingSteps.forEach((item, index) => item.classList.toggle("active", index <= step));
}

function resetScrollPosition() {
  const innerScroller = document.querySelector(".screens");
  innerScroller?.scrollTo({ top: 0, left: 0, behavior: "auto" });
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}

function goTo(index) {
  clearTimers();
  state.index = clamp(index, 0, screens.length - 1);
  const current = screens[state.index];
  els.screens.forEach((screen) => {
    screen.classList.toggle("active", screen.dataset.screen === current.id);
  });
  els.stepLabel.textContent = current.label;
  els.stepCount.textContent = `${state.index + 1}/${screens.length}`;
  els.progressBar.style.width = `${((state.index + 1) / screens.length) * 100}%`;
  els.backButton.disabled = state.index <= 0 || current.id === "loading";
  els.nextButton.textContent = current.cta;
  els.nextButton.disabled = current.id === "loading";
  document.body.dataset.currentScreen = current.id;
  // 화면 퍼널 추적(splash→start→airconTime→loading→report). 텔레메트리 미설정 시 no-op.
  (window.singleEnergyTrackPage || function () {})("screen:" + current.id);
  resetScrollPosition();
  if (current.id === "loading") runLoading();
}

async function runLoading() {
  const payload = buildPayload();
  const request = requestPrediction(payload);
  const minimumReadingTime = delay(5200);

  setLoadingStep(0);
  await delay(1250);
  setLoadingStep(1);
  await delay(1250);
  setLoadingStep(2);
  await delay(1250);
  setLoadingStep(3);

  const [prediction] = await Promise.all([request, minimumReadingTime]);
  state.lastPrediction = prediction;
  // 예측 결과 추적 — source(live/sample/fallback) 비율은 '폴백 불투명성'의 실측 지표.
  (window.singleEnergyTrack || function () {})("prediction_result", {
    source: prediction.source,
    predicted_kwh: prediction.predicted_kwh,
    estimated_bill: prediction.estimated_bill,
    error: prediction.error,
  });
  renderPrediction(prediction);
  goTo(screens.findIndex((screen) => screen.id === "report"));
}

function goNext() {
  const current = screens[state.index].id;
  if (current === "airconTime") {
    normalizeAirconHoursInput();
    syncAirconPowerState();
    normalizeAirconPowerInput();
    renderAirconTimeHint();
    // renderPrediction()은 runLoading()이 예측 결과로 수행한다(중복 렌더 제거).
    goTo(screens.findIndex((screen) => screen.id === "loading"));
    return;
  }
  if (current === "report") {
    goTo(0);
    return;
  }
  goTo(state.index + 1);
}

function bindAirconRangeDrag() {
  let activePointerId = null;

  if (window.PointerEvent) {
    els.airconHoursRange.addEventListener("pointerdown", (event) => {
      if (els.airconHoursRange.disabled) return;
      activePointerId = event.pointerId;
      els.airconHoursRange.setPointerCapture?.(event.pointerId);
      updateAirconHoursFromClientX(event.clientX);
      event.preventDefault();
    });

    els.airconHoursRange.addEventListener("pointermove", (event) => {
      if (activePointerId !== event.pointerId) return;
      updateAirconHoursFromClientX(event.clientX);
      event.preventDefault();
    });

    const releasePointer = (event) => {
      if (activePointerId !== event.pointerId) return;
      updateAirconHoursFromClientX(event.clientX);
      activePointerId = null;
      event.preventDefault();
    };

    els.airconHoursRange.addEventListener("pointerup", releasePointer);
    els.airconHoursRange.addEventListener("pointercancel", () => {
      activePointerId = null;
    });
    return;
  }

  els.airconHoursRange.addEventListener("touchstart", (event) => {
    if (els.airconHoursRange.disabled) return;
    updateAirconHoursFromClientX(event.touches[0].clientX);
    event.preventDefault();
  }, { passive: false });

  els.airconHoursRange.addEventListener("touchmove", (event) => {
    if (els.airconHoursRange.disabled) return;
    updateAirconHoursFromClientX(event.touches[0].clientX);
    event.preventDefault();
  }, { passive: false });
}

function setTheme(theme) {
  document.body.dataset.theme = theme;
  localStorage.setItem("mapo-electric-theme", theme);
  if (!els.themeButton) return;
  els.themeButton.textContent = theme === "dark" ? "라이트" : "다크";
  els.themeButton.setAttribute("aria-label", theme === "dark" ? "라이트 모드로 보기" : "다크 모드로 보기");
}

function toggleContactPanel(forceOpen) {
  if (!els.contactBotButton || !els.contactBotPanel) return;
  const nextOpen = typeof forceOpen === "boolean" ? forceOpen : els.contactBotPanel.hidden;
  els.contactBotPanel.hidden = !nextOpen;
  els.contactBotButton.setAttribute("aria-expanded", String(nextOpen));
  if (nextOpen) {
    setTimeout(() => els.chatInput?.focus(), 80);
  }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function appendChatMessage(role, content, { pending = false } = {}) {
  if (!els.chatMessages) return null;
  const item = document.createElement("div");
  item.className = `chat-message ${role}${pending ? " is-pending" : ""}`;
  item.innerHTML = `
    <span>${role === "user" ? "나" : "찌릿"}</span>
    <p>${escapeHtml(content)}</p>
  `;
  els.chatMessages.appendChild(item);
  els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
  return item;
}

function getChatContext() {
  const payload = buildPayload();
  const prediction = state.lastPrediction || localMockPredict(payload);
  const baselineKwh = Number(prediction.baseline_kwh) > 0 ? Number(prediction.baseline_kwh) : BASELINE_KWH;
  const baselineBill = Number(prediction.baseline_bill) > 0 ? Number(prediction.baseline_bill) : calculateElectricBill(baselineKwh);
  const risk = getRisk(prediction.predicted_kwh, baselineKwh);
  const billGap = Math.round(prediction.estimated_bill - baselineBill);
  const usageGap = Math.round(prediction.predicted_kwh - baselineKwh);
  return {
    service: "마포구 원룸 1인 가구 전기요금 예측 서비스 '찌릿'",
    payload,
    prediction: {
      predicted_kwh: prediction.predicted_kwh,
      estimated_bill_range: formatBillRange(prediction.estimated_bill),
      baseline_kwh: baselineKwh,
      baseline_bill_range: formatBillRange(baselineBill),
      usage_gap_kwh: usageGap,
      bill_gap_range: formatGapRange(Math.abs(billGap)),
      risk: risk.label,
    },
    visible_report: {
      type: els.reportTypeName?.textContent?.trim() || "",
      one_line: els.reportOneLine?.textContent?.trim() || "",
      reason: els.shareReason?.textContent?.trim() || "",
      mission: els.shareMission?.textContent?.trim() || "",
    },
  };
}

function buildLocalChatReply(message, context) {
  const text = message.replace(/\s+/g, " ").trim();
  const { payload, prediction } = context;
  const hours = payload.aircon_hours_per_day;
  const bill = prediction.estimated_bill_range;
  const risk = prediction.risk;
  const type = AIRCON_TYPE_LABELS[payload.aircon_type] || "잘 모름";

  if (/왜|이유|위험|주의/.test(text)) {
    return `현재 결과가 '${risk}'으로 나온 핵심 이유는 하루 에어컨 사용 시간이 ${formatHours(hours)}시간으로 들어갔기 때문이에요. 예상 사용량은 ${formatNumber(prediction.predicted_kwh)}kWh이고, 예상 요금은 ${bill} 범위로 보여요.`;
  }
  if (/줄|절약|아끼|낮/.test(text)) {
    return hours > 0
      ? `가장 먼저 할 일은 취침 전 예약 종료예요. 지금 입력값 기준에서는 에어컨 사용 시간을 줄이는 행동이 예측에 가장 직접적으로 반영돼요.`
      : `에어컨 사용 시간이 0시간이라 냉방 쪽 절약 여지는 작아요. 대신 냉장고, 드라이기처럼 기본 가전 사용 습관 점검 메시지를 보여주는 게 좋아요.`;
  }
  if (/정속|인버터|소비전력|W/.test(text)) {
    return `현재 에어컨 타입은 '${type}'으로 참고 입력돼 있어요. 소비전력을 직접 입력하면 백엔드 요청에 함께 보내지만, 화면에서는 사용 시간을 중심으로 설명해요.`;
  }
  return `지금 조건 기준 예상 요금은 ${bill}예요. 이 답변은 실제 고지서가 아니라 현재 입력값과 마포구 1인 가구 기준을 바탕으로 설명하는 참고 답변이에요.`;
}

async function requestChatReply(message) {
  const context = getChatContext();
  const history = state.chatMessages.slice(-6);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);
  try {
    const response = await fetch(CHAT_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, context, history }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error("chat request failed");
    const data = await response.json();
    if (!data.reply) throw new Error("chat reply missing");
    return data.reply;
  } catch (error) {
    console.warn("[single-energy] Falling back to local chat reply.", error.message);
    return buildLocalChatReply(message, context);
  } finally {
    clearTimeout(timer);
  }
}

async function sendChatMessage(message) {
  const cleaned = String(message || "").trim();
  if (!cleaned) return;

  if (els.chatInput) els.chatInput.value = "";
  appendChatMessage("user", cleaned);
  state.chatMessages.push({ role: "user", content: cleaned });

  const pending = appendChatMessage("bot", "입력값이랑 리포트를 같이 보고 있어요...", { pending: true });
  els.chatForm?.querySelector("button")?.setAttribute("disabled", "true");
  els.demoQuestionButtons.forEach((button) => {
    button.disabled = true;
  });
  try {
    const reply = await requestChatReply(cleaned);
    if (pending) {
      pending.classList.remove("is-pending");
      pending.querySelector("p").textContent = reply;
    } else {
      appendChatMessage("bot", reply);
    }
    state.chatMessages.push({ role: "assistant", content: reply });
  } finally {
    els.chatForm?.querySelector("button")?.removeAttribute("disabled");
    els.demoQuestionButtons.forEach((button) => {
      button.disabled = false;
    });
  }
}

async function handleChatSubmit(event) {
  event.preventDefault();
  const message = els.chatInput?.value.trim();
  if (!message) return;
  await sendChatMessage(message);
}

function buildFeedbackBody(message) {
  const context = getChatContext();
  const payload = context.payload;
  const prediction = context.prediction;
  return [
    "[찌릿 오류/피드백 제보]",
    "",
    `피드백 내용: ${message || "내용 미입력"}`,
    "",
    "[현재 리포트 상태]",
    `예상 사용량: ${prediction.predicted_kwh}kWh`,
    `예상 요금: ${prediction.estimated_bill_range}`,
    `위험도: ${prediction.risk}`,
    `기준 대비 사용량: ${prediction.usage_gap_kwh}kWh`,
    `기준 대비 요금 차이: ${prediction.bill_gap_range}`,
    "",
    "[사용자 입력값]",
    "지역: 마포구",
    "주거/가구: 원룸 / 1인",
    `에어컨 사용 시간: ${payload.aircon_hours_per_day}시간`,
    `에어컨 타입: ${AIRCON_TYPE_LABELS[payload.aircon_type] || payload.aircon_type}`,
    `소비전력: ${payload.aircon_power_w || "평균값"}W`,
    "",
    `[페이지] ${location.href}`,
  ].join("\n");
}

function handleFeedbackSubmit(event) {
  event.preventDefault();
  const message = els.feedbackInput?.value.trim() || "";
  const subject = encodeURIComponent("[찌릿] 오류/피드백 제보");
  const body = encodeURIComponent(buildFeedbackBody(message));
  window.location.href = `mailto:letgojh@gmail.com?subject=${subject}&body=${body}`;
  if (els.feedbackStatus) {
    els.feedbackStatus.textContent = "메일 앱이 열리면 내용을 확인하고 전송해 주세요.";
  }
}

function setShareStatus(message) {
  if (!els.shareStatus) return;
  els.shareStatus.textContent = message;
}

function getExportCss() {
  return [...document.styleSheets]
    .map((sheet) => {
      try {
        return [...sheet.cssRules]
          .filter((rule) => rule.type !== CSSRule.FONT_FACE_RULE)
          .map((rule) => rule.cssText)
          .join("\n");
      } catch (error) {
        return "";
      }
    })
    .join("\n");
}

function applyThemeVariablesForExport(clone) {
  const source = getComputedStyle(document.body);
  [
    "--blue",
    "--green",
    "--orange",
    "--red",
    "--bg",
    "--phone",
    "--surface",
    "--surface-strong",
    "--card",
    "--text",
    "--strong",
    "--muted",
    "--subtle",
    "--line",
    "--warm",
    "--green-soft",
    "--shadow",
  ].forEach((name) => clone.style.setProperty(name, source.getPropertyValue(name)));
}

function drawRoundRect(context, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + width, y, x + width, y + height, r);
  context.arcTo(x + width, y + height, x, y + height, r);
  context.arcTo(x, y + height, x, y, r);
  context.arcTo(x, y, x + width, y, r);
  context.closePath();
}

function fillRoundRect(context, x, y, width, height, radius, fillStyle) {
  context.fillStyle = fillStyle;
  drawRoundRect(context, x, y, width, height, radius);
  context.fill();
}

function drawTextBlock(context, text, x, y, maxWidth, lineHeight, maxLines = 3) {
  const words = String(text).split(" ");
  const lines = [];
  let line = "";

  words.forEach((word) => {
    const test = line ? `${line} ${word}` : word;
    if (context.measureText(test).width <= maxWidth) {
      line = test;
      return;
    }
    if (line) lines.push(line);
    line = word;
  });
  if (line) lines.push(line);

  lines.slice(0, maxLines).forEach((item, index) => {
    context.fillText(item, x, y + index * lineHeight);
  });
  return y + Math.min(lines.length, maxLines) * lineHeight;
}

function getCanvasReportSnapshot() {
  const summary = [
    ["하루 사용", els.summaryAirconHours.textContent.trim()],
    ["지역", "마포구"],
    ["가구", "1인 원룸"],
  ];

  return {
    profile: els.shareReportCard.dataset.profile || "cooling",
    risk: els.reportRiskPill.textContent.trim(),
    typeName: els.reportTypeName.textContent.trim(),
    oneLine: els.reportOneLine.textContent.trim(),
    bill: els.shareBill.textContent.trim(),
    kwh: els.shareKwh.textContent.trim(),
    gap: els.shareGapText.textContent.trim(),
    baselineBill: els.shareBaselineBill.textContent.trim(),
    mineBill: els.shareMineBill.textContent.trim(),
    reason: els.shareReason.textContent.trim(),
    mission: els.shareMission.textContent.trim(),
    missionCopy: els.shareMissionCopy.textContent.trim(),
    visualMain: els.reportVisual.querySelector(".visual-main").textContent.trim(),
    visualSub: els.reportVisual.querySelector(".visual-sub").textContent.trim(),
    characterSrc: els.reportJjiritImg?.getAttribute("src") || "./assets/brand/characters/jjirit-basic.png",
    characterMood: els.reportCharacterMood?.textContent.trim() || "",
    missionIcon: els.missionVisual.querySelector("span").textContent.trim(),
    tips: [...els.tipList.querySelectorAll(".tip-card")].slice(0, 3).map((card) => ({
      icon: card.querySelector("b")?.textContent.trim() || "✓",
      title: card.querySelector("strong")?.textContent.trim() || "",
      detail: card.querySelector("p")?.textContent.trim() || "",
      badge: card.querySelector("span")?.textContent.trim() || "",
    })),
    summary,
  };
}

async function ensureCanvasFonts() {
  if (!("FontFace" in window) || !document.fonts) return;
  const fonts = [
    ["Moneygraphy Rounded", "./assets/fonts/Moneygraphy-Rounded.woff2"],
  ];

  await Promise.all(fonts.map(async ([family, url]) => {
    if (document.fonts.check(`16px "${family}"`)) return;
    const face = new FontFace(family, `url(${url})`);
    const loaded = await face.load();
    document.fonts.add(loaded);
  }));
  await document.fonts.ready;
}

function reportFont(weight, size) {
  return `${weight} ${size}px "Moneygraphy Rounded", "Malgun Gothic", Arial, sans-serif`;
}

function reportNumberFont(weight, size) {
  return `${weight} ${size}px "Moneygraphy Rounded", "Malgun Gothic", Arial, sans-serif`;
}

function loadCanvasImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function drawImageContain(ctx, image, x, y, width, height) {
  const ratio = Math.min(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * ratio;
  const drawHeight = image.naturalHeight * ratio;
  const drawX = x + (width - drawWidth) / 2;
  const drawY = y + (height - drawHeight) / 2;
  ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);
}

async function createCanvasReportBlob() {
  await ensureCanvasFonts();
  const data = getCanvasReportSnapshot();
  const jjiritImage = await loadCanvasImage(new URL(data.characterSrc, window.location.href).href).catch(() => null);
  const palette = {
    alert: "#ef4444",
    cooling: "#3182f6",
    steady: "#00a86b",
  };
  const riskPalette = {
    위험: "#ef4444",
    주의: "#f59e0b",
    안정: "#00a86b",
  };
  const accent = riskPalette[data.risk] || palette[data.profile] || palette.cooling;
  const canvas = document.createElement("canvas");
  const width = 1080;
  const height = 2800;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  ctx.fillStyle = "#f5f7fb";
  ctx.fillRect(0, 0, width, height);
  fillRoundRect(ctx, 42, 42, 996, 2716, 64, "#ffffff");

  ctx.fillStyle = "#eef5ff";
  ctx.beginPath();
  ctx.arc(885, 230, 170, 0, Math.PI * 2);
  ctx.fill();

  fillRoundRect(ctx, 86, 98, 310, 58, 29, "#eef5ff");
  ctx.fillStyle = accent;
  ctx.font = reportFont(800, 30);
  ctx.fillText("찌릿 리포트", 116, 138);

  fillRoundRect(ctx, 830, 100, 116, 58, 29, `${accent}22`);
  ctx.fillStyle = accent;
  ctx.font = reportFont(900, 30);
  ctx.textAlign = "center";
  ctx.fillText(data.risk, 888, 138);
  ctx.textAlign = "left";

  ctx.fillStyle = "#6b7684";
  ctx.font = reportFont(800, 30);
  ctx.fillText("이번 달 전기세 타입", 86, 224);
  ctx.fillStyle = "#101317";
  ctx.font = reportFont(900, 70);
  drawTextBlock(ctx, data.typeName, 86, 306, 610, 76, 2);
  ctx.fillStyle = "#333d4b";
  ctx.font = reportFont(800, 32);
  drawTextBlock(ctx, data.oneLine, 86, 414, 580, 42, 2);

  fillRoundRect(ctx, 738, 190, 216, 246, 58, "#f5f9ff");
  if (jjiritImage) {
    drawImageContain(ctx, jjiritImage, 750, 232, 176, 160);
  }
  ctx.fillStyle = accent;
  ctx.font = "54px Apple Color Emoji, Segoe UI Emoji, sans-serif";
  ctx.fillText(data.visualMain, 766, 258);
  fillRoundRect(ctx, 866, 340, 70, 70, 35, accent);
  ctx.fillStyle = "#ffffff";
  ctx.font = reportFont(900, 38);
  ctx.textAlign = "center";
  ctx.fillText(data.visualSub, 901, 387);
  if (data.characterMood) {
    const moodWidth = Math.max(122, Math.min(178, data.characterMood.length * 28 + 38));
    fillRoundRect(ctx, 846 - moodWidth / 2, 408, moodWidth, 46, 23, accent);
    ctx.fillStyle = "#ffffff";
    ctx.font = reportFont(900, 24);
    ctx.fillText(data.characterMood, 846, 439);
  }
  ctx.textAlign = "left";

  fillRoundRect(ctx, 86, 500, 908, 210, 40, "#f7f8fa");
  ctx.fillStyle = "#191f28";
  ctx.font = reportFont(900, 36);
  ctx.fillText("예상 전기요금", 126, 568);
  ctx.fillStyle = accent;
  ctx.font = reportNumberFont(900, data.bill.length > 14 ? 54 : data.bill.length > 8 ? 72 : 88);
  ctx.fillText(data.bill, 126, 650);
  ctx.fillStyle = "#6b7684";
  ctx.font = reportFont(800, 30);
  ctx.fillText(`예상 사용량 ${data.kwh}`, 126, 690);

  fillRoundRect(ctx, 86, 746, 908, 250, 40, "#f7f8fa");
  ctx.fillStyle = "#191f28";
  ctx.font = reportFont(900, 38);
  ctx.fillText("마포구 1인 가구 기준 비교", 126, 820);
  ctx.fillStyle = "#1f6feb";
  ctx.font = reportFont(800, 30);
  drawTextBlock(ctx, data.gap, 126, 866, 760, 38, 2);
  ctx.fillStyle = "#6b7684";
  ctx.font = reportFont(800, 28);
  ctx.fillText("기준", 126, 930);
  fillRoundRect(ctx, 250, 904, 360, 38, 18, "#d7dde5");
  ctx.fillStyle = "#6b7684";
  ctx.font = reportFont(900, data.baselineBill.length > 14 ? 18 : 25);
  ctx.textAlign = "right";
  ctx.fillText(data.baselineBill, 982, 934);
  ctx.textAlign = "left";
  ctx.fillStyle = "#191f28";
  ctx.font = reportFont(900, 28);
  ctx.fillText("내 예상", 126, 978);
  fillRoundRect(ctx, 250, 952, 470, 38, 18, accent);
  ctx.fillStyle = accent;
  ctx.font = reportFont(900, data.mineBill.length > 14 ? 18 : 25);
  ctx.textAlign = "right";
  ctx.fillText(data.mineBill, 982, 982);
  ctx.textAlign = "left";

  fillRoundRect(ctx, 86, 1030, 908, 158, 40, "#f7f8fa");
  fillRoundRect(ctx, 126, 1076, 64, 64, 22, `${accent}18`);
  ctx.fillStyle = accent;
  ctx.font = reportFont(900, 40);
  ctx.textAlign = "center";
  ctx.fillText(data.profile === "steady" ? "✓" : "↗", 158, 1122);
  ctx.textAlign = "left";
  ctx.fillStyle = "#191f28";
  ctx.font = reportFont(900, 36);
  ctx.fillText("가장 큰 요인", 226, 1088);
  ctx.fillStyle = "#333d4b";
  ctx.font = reportFont(800, 30);
  drawTextBlock(ctx, data.reason, 226, 1136, 690, 38, 2);

  fillRoundRect(ctx, 86, 1222, 908, 216, 40, "#eefaf5");
  ctx.font = "78px Apple Color Emoji, Segoe UI Emoji, sans-serif";
  ctx.fillText(data.missionIcon, 132, 1336);
  fillRoundRect(ctx, 216, 1320, 66, 66, 33, "#ffd76a");
  ctx.fillStyle = "#8a5a00";
  ctx.font = reportFont(900, 36);
  ctx.textAlign = "center";
  ctx.fillText("₩", 249, 1364);
  ctx.textAlign = "left";
  ctx.fillStyle = "#6b7684";
  ctx.font = reportFont(800, 28);
  ctx.fillText("오늘의 조정 1순위", 326, 1288);
  ctx.fillStyle = "#191f28";
  ctx.font = reportFont(900, 38);
  drawTextBlock(ctx, data.mission, 326, 1342, 580, 44, 2);
  ctx.fillStyle = "#00a86b";
  ctx.font = reportFont(850, 28);
  drawTextBlock(ctx, data.missionCopy, 326, 1400, 580, 34, 2);

  ctx.fillStyle = "#191f28";
  ctx.font = reportFont(900, 42);
  ctx.fillText("추가로 조정하면 좋은 것", 86, 1548);

  data.tips.forEach((tip, index) => {
    const y = 1584 + index * 190;
    fillRoundRect(ctx, 86, y, 908, 154, 32, "#f7f8fa");
    fillRoundRect(ctx, 122, y + 38, 76, 76, 28, "#eef5ff");
    ctx.font = "44px Apple Color Emoji, Segoe UI Emoji, sans-serif";
    ctx.fillText(tip.icon, 138, y + 91);
    ctx.fillStyle = "#191f28";
    ctx.font = reportFont(900, 34);
    drawTextBlock(ctx, tip.title, 226, y + 56, 520, 40, 1);
    ctx.fillStyle = "#6b7684";
    ctx.font = reportFont(760, 26);
    drawTextBlock(ctx, tip.detail, 226, y + 99, 500, 34, 2);
    fillRoundRect(ctx, 704, y + 44, 250, 48, 24, "#dff8ec");
    ctx.fillStyle = "#00a86b";
    ctx.font = reportFont(900, tip.badge.length > 8 ? 19 : 22);
    ctx.textAlign = "center";
    ctx.fillText(tip.badge, 829, y + 77);
    ctx.textAlign = "left";
  });

  ctx.fillStyle = "#191f28";
  ctx.font = reportFont(900, 42);
  ctx.fillText("입력 조건 요약", 86, 2260);

  data.summary.forEach(([label, value], index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = 86 + col * 454;
    const y = 2300 + row * 122;
    fillRoundRect(ctx, x, y, 424, 94, 28, "#f7f8fa");
    ctx.fillStyle = "#8b95a1";
    ctx.font = reportFont(800, 24);
    ctx.fillText(label, x + 30, y + 38);
    ctx.fillStyle = "#191f28";
    ctx.font = reportFont(900, 34);
    ctx.fillText(value, x + 30, y + 78);
  });

  fillRoundRect(ctx, 86, 2576, 908, 92, 32, "#fff7e8");
  ctx.fillStyle = "#8b95a1";
  ctx.font = reportFont(760, 28);
  drawTextBlock(
    ctx,
    "AI 예측 결과라 실제 청구요금과 다를 수 있어요. 검침일, 누진구간, 할인 여부에 따라 달라질 수 있어요.",
    126,
    2628,
    820,
    34,
    2,
  );

  return await new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("이미지를 만들지 못했어요."));
    }, "image/png");
  });
}

async function renderReportWithHtml2Canvas() {
  if (!window.html2canvas) return null;
  const canvas = await window.html2canvas(els.shareReportCard, {
    backgroundColor: null,
    scale: Math.min(2, window.devicePixelRatio || 1.5),
    useCORS: true,
    logging: false,
  });

  return await new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("이미지를 만들지 못했어요."));
    }, "image/png");
  });
}

function createReportSvgBlob() {
  const node = els.shareReportCard;
  const rect = node.getBoundingClientRect();
  const width = Math.ceil(rect.width);
  const height = Math.ceil(rect.height);
  const clone = node.cloneNode(true);

  applyThemeVariablesForExport(clone);
  clone.classList.add("exporting-card");
  clone.style.width = `${width}px`;
  clone.style.margin = "0";
  clone.style.boxShadow = "none";
  clone.style.fontFamily = '"Malgun Gothic", "Apple SD Gothic Neo", Arial, sans-serif';

  const serialized = new XMLSerializer().serializeToString(clone);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <foreignObject width="100%" height="100%">
        <div xmlns="http://www.w3.org/1999/xhtml">
          <style>${getExportCss()}</style>
          ${serialized}
        </div>
      </foreignObject>
    </svg>
  `;

  return new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
}

async function createReportImageBlob() {
  try {
    return await createCanvasReportBlob();
  } catch (error) {
    console.warn("[single-energy] canvas report export failed. Trying DOM export.", error);
  }

  try {
    const canvasBlob = await renderReportWithHtml2Canvas();
    if (canvasBlob) return canvasBlob;
  } catch (error) {
    console.warn("[single-energy] html2canvas export failed. Falling back to SVG.", error);
  }

  const node = els.shareReportCard;
  const rect = node.getBoundingClientRect();
  const width = Math.ceil(rect.width);
  const height = Math.ceil(rect.height);
  const scale = Math.min(2, window.devicePixelRatio || 1.5);
  const clone = node.cloneNode(true);

  applyThemeVariablesForExport(clone);
  clone.classList.add("exporting-card");
  clone.style.width = `${width}px`;
  clone.style.margin = "0";
  clone.style.boxShadow = "none";
  clone.style.fontFamily = '"Malgun Gothic", "Apple SD Gothic Neo", Arial, sans-serif';

  if (document.fonts?.ready) await document.fonts.ready;

  const serialized = new XMLSerializer().serializeToString(clone);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <foreignObject width="100%" height="100%">
        <div xmlns="http://www.w3.org/1999/xhtml">
          <style>${getExportCss()}</style>
          ${serialized}
        </div>
      </foreignObject>
    </svg>
  `;
  const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);

  try {
    const image = new Image();
    image.decoding = "async";
    image.src = url;
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
    });

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const context = canvas.getContext("2d");
    context.scale(scale, scale);
    context.fillStyle = getComputedStyle(node).backgroundColor || "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    return await new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("이미지를 만들지 못했어요."));
      }, "image/png");
    });
  } catch (error) {
    console.warn("[single-energy] canvas export failed. Falling back to SVG.", error);
    return createReportSvgBlob();
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function saveReportImage() {
  try {
    setShareStatus("이미지를 만들고 있어요.");
    const blob = await createReportImageBlob();
    const extension = blob.type.includes("svg") ? "svg" : "png";
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `mapo-electric-report-${Date.now()}.${extension}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setShareStatus("리포트 이미지를 저장했어요.");
  } catch (error) {
    console.error("[single-energy] image save failed", error);
    setShareStatus("이미지 저장이 막혔어요. 화면 캡처로 저장해 주세요.");
  }
}

async function copyShareUrl() {
  const url = window.location.href.split("#")[0];
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    await navigator.clipboard.writeText(url);
    return true;
  }

  const input = document.createElement("input");
  input.value = url;
  input.setAttribute("readonly", "");
  input.style.position = "fixed";
  input.style.left = "-9999px";
  document.body.appendChild(input);
  input.select();
  const copied = document.execCommand("copy");
  input.remove();
  return copied;
}

async function shareReportImage() {
  try {
    setShareStatus("SNS 공유를 준비하고 있어요.");
    const title = "찌릿 전기요금 리포트";
    const text = "이번 달 전기세를 미리 확인해봤어요.";
    const shareUrl = window.location.href.split("#")[0];
    const isMobileShare = window.isSecureContext && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    if (isMobileShare) {
      const blob = await createReportImageBlob();
      const file = new File([blob], "jjirit-electric-report.png", { type: blob.type || "image/png" });

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title, text, files: [file] });
        setShareStatus("공유 화면을 열었어요.");
        return;
      }

      if (navigator.share) {
        await navigator.share({ title, text, url: shareUrl });
        setShareStatus("공유 화면을 열었어요.");
        return;
      }
    }

    const copied = await copyShareUrl();
    setShareStatus(copied ? "SNS에 붙여넣을 링크를 복사했어요." : "공유가 막혔어요. 이미지 저장을 사용해 주세요.");
  } catch (error) {
    if (error.name === "AbortError") {
      setShareStatus("공유를 취소했어요.");
      return;
    }
    console.error("[single-energy] share failed", error);
    try {
      const copied = await copyShareUrl();
      setShareStatus(copied ? "공유가 막혀서 링크를 복사했어요." : "공유가 막혔어요. 이미지 저장을 사용해 주세요.");
    } catch (copyError) {
      console.error("[single-energy] url copy failed", copyError);
      setShareStatus("공유가 막혔어요. 이미지 저장을 사용해 주세요.");
    }
  }
}

// 재발방지 가드: 마크업에 [data-screen]이 있는데 screens 마법사 배열에 없으면
// 영원히 활성화되지 않는 "고아 스크린"이다(2026-06-24 dev 머지가 죽은 result
// 스크린을 되살린 회귀의 클래스). 런타임 비용 없이(1회) 콘솔로 즉시 알린다.
function warnOnOrphanScreens() {
  const known = new Set(screens.map((screen) => screen.id));
  const orphans = els.screens
    .map((screen) => screen.dataset.screen)
    .filter((id) => id && !known.has(id));
  if (orphans.length) {
    console.warn(
      "[single-energy] 마법사 배열에 없는 고아 스크린이 있어요(죽은 마크업일 수 있음):",
      orphans,
    );
  }
}

function init() {
  bindAirconRangeDrag();
  els.airconHoursInput.addEventListener("input", () => {
    state.airconTimeTouched = true;
    setAirconHoursValue(getAirconHours());
  });
  els.airconHoursRange.addEventListener("input", () => {
    state.airconTimeTouched = true;
    setAirconHoursValue(numberOnly(els.airconHoursRange.value));
  });
  els.airconHoursInput.addEventListener("blur", () => {
    normalizeAirconHoursInput();
    syncAirconPowerState();
    renderAirconTimeHint();
  });
  els.airconPowerInput?.addEventListener("input", () => {
    state.referenceInputTouched = true;
    state.airconPowerW = getAirconPowerW();
    renderAirconPowerHint();
  });
  els.airconPowerInput?.addEventListener("blur", () => {
    normalizeAirconPowerInput({ writeValue: true });
  });
  els.airconTypeBlock?.addEventListener("toggle", () => {
    if (els.airconTypeBlock.open && hasAirconUsage()) {
      state.referenceInputTouched = true;
    }
    renderAirconPowerHint();
  });
  els.airconTypeButtons.forEach((button) => {
    button.addEventListener("click", () => setAirconType(button.dataset.airconType));
  });
  els.contactBotButton?.addEventListener("click", () => toggleContactPanel());
  els.contactCloseButton?.addEventListener("click", () => toggleContactPanel(false));
  els.chatForm?.addEventListener("submit", handleChatSubmit);
  els.chatInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      els.chatForm?.requestSubmit();
    }
  });
  els.demoQuestionButtons.forEach((button) => {
    button.addEventListener("click", () => sendChatMessage(button.dataset.demoQuestion));
  });
  els.feedbackForm?.addEventListener("submit", handleFeedbackSubmit);
  els.backButton.addEventListener("click", () => goTo(state.index - 1));
  els.nextButton.addEventListener("click", goNext);
  els.saveImageButton.addEventListener("click", saveReportImage);
  els.shareImageButton.addEventListener("click", shareReportImage);
  els.resetReportButton?.addEventListener("click", () => goTo(0));
  setTheme("light");
  normalizeAirconHoursInput();
  syncAirconPowerState();
  normalizeAirconPowerInput();
  renderAirconTimeHint();
  renderPrediction();
  goTo(0);
  warnOnOrphanScreens();

  window.singleEnergyFrontend = {
    buildPayload,
    calculateElectricBill,
    getPredictEndpoint: () => PREDICT_ENDPOINT,
    getChatEndpoint: () => CHAT_ENDPOINT,
  };
}

init();
