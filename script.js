const BASELINE_KWH = 165;
const BASELINE_BILL = calculateElectricBill(BASELINE_KWH);
const API_BASE_URL = (
  window.SINGLE_ENERGY_API_BASE_URL || "http://127.0.0.1:8000"
).replace(/\/$/, "");
const PREDICT_ENDPOINT = `${API_BASE_URL}/predict`;

const screens = [
  { id: "start", label: "시작", cta: "시작하기" },
  { id: "area", label: "평수", cta: "다음" },
  { id: "devices", label: "항목", cta: "예상 요금 보기" },
  { id: "loading", label: "분석", cta: "계산 중" },
  { id: "result", label: "결과", cta: "절약 리포트 보기" },
  { id: "report", label: "리포트", cta: "다시 계산하기" },
];

const state = {
  index: 0,
  aircon: "yes",
  heating: "gas",
  induction: "yes",
  lastPrediction: null,
  timers: [],
};

const els = {
  themeButton: document.querySelector("#themeButton"),
  progressBar: document.querySelector("#progressBar"),
  stepLabel: document.querySelector("#stepLabel"),
  stepCount: document.querySelector("#stepCount"),
  screens: [...document.querySelectorAll(".screen")],
  backButton: document.querySelector("#backButton"),
  nextButton: document.querySelector("#nextButton"),
  pyeongInput: document.querySelector("#pyeongInput"),
  pyeongRange: document.querySelector("#pyeongRange"),
  areaHint: document.querySelector("#areaHint"),
  loadingTitle: document.querySelector("#loadingTitle"),
  loadingCopy: document.querySelector("#loadingCopy"),
  loadingSteps: [...document.querySelectorAll("[data-loading-step]")],
  riskBadge: document.querySelector("#riskBadge"),
  resultBillHero: document.querySelector("#resultBillHero"),
  resultKwhNumber: document.querySelector("#resultKwhNumber"),
  resultRiskText: document.querySelector("#resultRiskText"),
  baselineKwhMini: document.querySelector("#baselineKwhMini"),
  baselineKwh: document.querySelector("#baselineKwh"),
  myKwh: document.querySelector("#myKwh"),
  baselineUsageBar: document.querySelector("#baselineUsageBar"),
  myUsageBar: document.querySelector("#myUsageBar"),
  usageReason: document.querySelector("#usageReason"),
  baselineBill: document.querySelector("#baselineBill"),
  billDelta: document.querySelector("#billDelta"),
  shareReportCard: document.querySelector("#shareReportCard"),
  reportRiskPill: document.querySelector("#reportRiskPill"),
  reportTypeName: document.querySelector("#reportTypeName"),
  reportOneLine: document.querySelector("#reportOneLine"),
  reportVisual: document.querySelector("#reportVisual"),
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
  shareSaving: document.querySelector("#shareSaving"),
  shareFunnyLine: document.querySelector("#shareFunnyLine"),
  saveImageButton: document.querySelector("#saveImageButton"),
  shareImageButton: document.querySelector("#shareImageButton"),
  shareStatus: document.querySelector("#shareStatus"),
  tipList: document.querySelector("#tipList"),
  summaryPyeong: document.querySelector("#summaryPyeong"),
  summaryArea: document.querySelector("#summaryArea"),
  summaryAircon: document.querySelector("#summaryAircon"),
  summaryHeating: document.querySelector("#summaryHeating"),
  summaryInduction: document.querySelector("#summaryInduction"),
};

function numberOnly(value) {
  return Number(String(value).replace(/[^\d.]/g, "")) || 0;
}

function formatNumber(value) {
  return Math.round(value).toLocaleString("ko-KR");
}

function formatWon(value) {
  return `${formatNumber(value)}원`;
}

function formatPyeong(value) {
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
  return Math.round((subtotal + vat + fund) / 100) * 100;
}

function getPyeong() {
  return clamp(numberOnly(els.pyeongInput.value) || 8, 4, 18);
}

function getAreaM2() {
  return Number((getPyeong() * 3.3058).toFixed(1));
}

function normalizePyeongInput() {
  const value = getPyeong();
  els.pyeongInput.value = Number.isInteger(value) ? String(value) : value.toFixed(1);
  els.pyeongRange.value = String(value);
}

function buildPayload() {
  return {
    area_m2: getAreaM2(),
    pyeong: getPyeong(),
    region: "mapo",
    housing_type: "oneroom",
    household_size: 1,
    has_aircon: state.aircon === "yes",
    heating_type: state.heating,
    has_induction: state.induction === "yes",
  };
}

function localMockPredict(payload) {
  let kwh = 82 + payload.pyeong * 6.8;
  kwh += payload.has_aircon ? 41 : 6;
  if (payload.heating_type === "electric") kwh += 42;
  if (payload.heating_type === "district") kwh += 8;
  if (payload.has_induction) kwh += 12;

  const predictedKwh = Math.round(clamp(kwh, 85, 430));
  return {
    predicted_kwh: predictedKwh,
    estimated_bill: calculateElectricBill(predictedKwh),
    source: "sample",
  };
}

function normalizePredictionResponse(data) {
  const predicted = Number(data.predicted_kwh ?? data.expected_kwh ?? data.kwh);
  if (!Number.isFinite(predicted) || predicted <= 0) {
    throw new Error("Invalid prediction response: predicted_kwh is required");
  }

  const bill = Number(data.estimated_bill ?? data.bill ?? data.estimated_won);
  return {
    predicted_kwh: predicted,
    estimated_bill: Number.isFinite(bill) && bill > 0 ? bill : calculateElectricBill(predicted),
    source: "live",
    raw: data,
  };
}

async function requestPrediction(payload) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1800);
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

function getRisk(kwh) {
  const gap = kwh - BASELINE_KWH;
  if (gap >= 85) return { label: "높음", color: "#ef4444", text: "마포구 1인 가구 기준보다 꽤 높아요." };
  if (gap >= 20) return { label: "주의", color: "#f59e0b", text: "마포구 1인 가구 기준보다 조금 높아요." };
  return { label: "안정", color: "#00a86b", text: "마포구 1인 가구 기준과 비슷해요." };
}

function heatingLabel(value) {
  if (value === "electric") return "전기";
  if (value === "district") return "지역난방";
  return "가스";
}

function getReason(payload, prediction) {
  const gap = Math.round(prediction.predicted_kwh - BASELINE_KWH);
  const reasons = [];

  if (payload.pyeong >= 10) reasons.push("평수가 큰 편이고");
  if (payload.has_aircon) reasons.push("에어컨을 쓰고");
  if (payload.heating_type === "electric") reasons.push("전기 난방을 쓰고");
  if (payload.has_induction) reasons.push("인덕션을 써서");

  const lead = reasons.length ? reasons.join(" ") : "기본 생활 전력 기준으로";
  if (gap > 0) return `${lead} 기준보다 약 ${formatNumber(gap)}kWh 더 쓸 가능성이 있어요.`;
  if (gap < 0) return `${lead} 기준보다 약 ${formatNumber(Math.abs(gap))}kWh 적게 쓸 가능성이 있어요.`;
  return `${lead} 기준 사용량과 거의 비슷해 보여요.`;
}

function getReportProfile(payload, prediction) {
  const gap = prediction.predicted_kwh - BASELINE_KWH;

  if (gap >= 85) {
    return {
      key: "alert",
      typeName: "전기세 빨간불형",
      oneLine: "이번 달은 고지서가 먼저 뛰어올 수 있어요.",
      visual: ["🚨", "₩"],
      reasonIcon: "!",
      reason: "예상 사용량이 마포구 1인 가구 기준보다 크게 높게 잡혔어요.",
    };
  }

  if (payload.heating_type === "electric") {
    return {
      key: "heating",
      typeName: "난방비 경계형",
      oneLine: "따뜻함은 챙기되, 요금은 살짝 조심해요.",
      visual: ["⚡", "🔥"],
      reasonIcon: "↗",
      reason: "전기 난방 조건이 요금 상승에 가장 크게 반영됐어요.",
    };
  }

  if (payload.has_aircon) {
    return {
      key: "cooling",
      typeName: "냉방비 과몰입형",
      oneLine: "전기세가 슬슬 말을 걸고 있어요.",
      visual: ["❄️", "₩"],
      reasonIcon: "↗",
      reason: "에어컨 사용 조건이 요금 상승에 크게 반영됐어요.",
    };
  }

  if (payload.has_induction) {
    return {
      key: "cooking",
      typeName: "인덕션 야식형",
      oneLine: "요리할 때 새는 전기도 한 번 볼 때예요.",
      visual: ["🍳", "₩"],
      reasonIcon: "↗",
      reason: "인덕션 사용 조건이 생활 전력 증가 요인으로 반영됐어요.",
    };
  }

  return {
    key: "steady",
    typeName: "생활전력 안정형",
    oneLine: "지금 패턴은 꽤 안정적으로 보여요.",
    visual: ["💡", "✓"],
    reasonIcon: "✓",
    reason: "선택한 조건은 마포구 1인 가구 기준과 크게 벗어나지 않아요.",
  };
}

function getTipCandidates(payload, prediction) {
  const before = prediction.estimated_bill;
  const candidates = [];

  if (payload.has_aircon) {
    candidates.push({
      icon: "❄️",
      title: "에어컨 하루 1시간 덜 켜기",
      detail: "잠들기 전 1시간만 먼저 끄면 한 달 요금이 꽤 가벼워져요.",
      kwh: 20,
    });
  }

  if (payload.heating_type === "electric") {
    candidates.push({
      icon: "⚡",
      title: "전기 난방 하루 20분 줄이기",
      detail: "난방을 오래 켜는 날만 줄여도 이번 달 요금을 낮출 수 있어요.",
      kwh: 18,
    });
  }

  if (payload.has_induction) {
    candidates.push({
      icon: "🍳",
      title: "인덕션 조리 시간을 한 번에 묶기",
      detail: "조리 횟수를 나누기보다 한 번에 묶으면 대기열과 예열 시간을 줄일 수 있어요.",
      kwh: 5,
    });
  }

  candidates.push({
    icon: "🔌",
    title: "외출 8시간 동안 멀티탭 전원 끄기",
    detail: "안 쓰는 충전기와 멀티탭만 꺼도 새는 전기를 줄일 수 있어요.",
    kwh: 4,
  });

  candidates.push({
    icon: "💡",
    title: "조명 사용 시간을 하루 1시간 줄이기",
    detail: "방을 비울 때 조명만 꺼도 작은 절약이 쌓여요.",
    kwh: 3,
  });

  return candidates
    .map((item) => {
      const afterBill = calculateElectricBill(Math.max(0, prediction.predicted_kwh - item.kwh));
      return { ...item, saving: Math.max(300, before - afterBill) };
    })
    .sort((a, b) => b.saving - a.saving)
    .slice(0, 3);
}

function renderAreaHint() {
  const pyeong = getPyeong();
  const area = getAreaM2();
  const percent = clamp(((pyeong - 4) / 14) * 100, 0, 100);
  els.pyeongRange.value = String(pyeong);
  els.pyeongRange.style.setProperty("--range-progress", `${percent}%`);
  els.areaHint.textContent = `${formatPyeong(pyeong)}평은 약 ${area}㎡로 계산해요.`;
}

function getSavingAnchor(saving) {
  if (saving >= 18000) return "한 달이면 치킨 한 마리 값에 가까워요.";
  if (saving >= 7000) return "두 달만 모아도 치킨값이 보여요.";
  if (saving >= 4500) return "편의점 커피 두세 잔 값이에요.";
  if (saving >= 2500) return "아이스 아메리카노 한 잔 값에 가까워요.";
  return "작아 보여도 매달 쌓이면 꽤 차이가 나요.";
}

function getShareFunnyLine(saving) {
  if (saving >= 18000) return "이번 달 치킨 방어 성공";
  if (saving >= 7000) return "두 달 모으면 치킨각";
  if (saving >= 4500) return "커피 두 잔은 지켰다";
  if (saving >= 2500) return "아아 한 잔은 살렸다";
  return "작아도 매달 쌓이면 큼";
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
          <span>약 ${formatWon(tip.saving)}</span>
        </article>
      `,
    )
    .join("");
}

function renderPrediction(prediction = state.lastPrediction) {
  const payload = buildPayload();
  const result = prediction || localMockPredict(payload);
  const risk = getRisk(result.predicted_kwh);
  const usageGap = Math.round(result.predicted_kwh - BASELINE_KWH);
  const billGap = Math.round(result.estimated_bill - BASELINE_BILL);
  const usageMax = Math.max(260, result.predicted_kwh, BASELINE_KWH);
  const tips = getTipCandidates(payload, result);
  const topTip = tips[0];
  const totalSaving = tips.reduce((sum, tip) => sum + tip.saving, 0);
  const profile = getReportProfile(payload, result);
  const billMax = Math.max(result.estimated_bill, BASELINE_BILL, 1);

  els.resultKwhNumber.textContent = formatNumber(result.predicted_kwh);
  els.resultBillHero.textContent = formatWon(result.estimated_bill);
  els.resultRiskText.textContent =
    billGap >= 0
      ? `마포구 1인 가구 기준보다 약 ${formatWon(Math.abs(billGap))} 높아요.`
      : `마포구 1인 가구 기준보다 약 ${formatWon(Math.abs(billGap))} 낮아요.`;
  els.riskBadge.textContent = risk.label;
  els.riskBadge.style.color = risk.color;
  els.riskBadge.style.background = `${risk.color}1f`;
  els.baselineKwhMini.textContent = formatNumber(BASELINE_KWH);
  els.baselineKwh.textContent = `${formatNumber(BASELINE_KWH)}kWh`;
  els.myKwh.textContent = `${formatNumber(result.predicted_kwh)}kWh`;
  els.baselineUsageBar.style.width = `${Math.max(26, (BASELINE_KWH / usageMax) * 100)}%`;
  els.myUsageBar.style.width = `${Math.max(26, (result.predicted_kwh / usageMax) * 100)}%`;
  els.myUsageBar.style.background = risk.color;
  els.usageReason.textContent = getReason(payload, result);
  els.baselineBill.textContent = formatWon(BASELINE_BILL);
  els.billDelta.textContent = `${billGap >= 0 ? "+" : "-"}${formatWon(Math.abs(billGap))}`;
  els.billDelta.style.color = billGap >= 0 ? risk.color : "#00a86b";

  els.shareReportCard.dataset.profile = profile.key;
  els.reportRiskPill.textContent = risk.label;
  els.reportRiskPill.style.color = risk.color;
  els.reportRiskPill.style.background = `${risk.color}1f`;
  els.reportTypeName.textContent = profile.typeName;
  els.reportOneLine.textContent = profile.oneLine;
  els.reportVisual.querySelector(".visual-main").textContent = profile.visual[0];
  els.reportVisual.querySelector(".visual-sub").textContent = profile.visual[1];
  els.shareBill.textContent = formatWon(result.estimated_bill);
  els.shareKwh.textContent = `${formatNumber(result.predicted_kwh)}kWh`;
  els.shareGapText.textContent =
    billGap >= 0
      ? `기준보다 ${formatWon(Math.abs(billGap))} 높게 예측됐어요`
      : `기준보다 ${formatWon(Math.abs(billGap))} 낮게 예측됐어요`;
  els.shareBaselineBill.textContent = formatWon(BASELINE_BILL);
  els.shareMineBill.textContent = formatWon(result.estimated_bill);
  els.shareBaselineBar.style.width = `${clamp((BASELINE_BILL / billMax) * 100, 24, 100)}%`;
  els.shareMineBar.style.width = `${clamp((result.estimated_bill / billMax) * 100, 24, 100)}%`;
  els.reasonIcon.textContent = profile.reasonIcon;
  els.shareReason.textContent = usageGap > 0 ? profile.reason : "현재 조건은 기준과 비슷하지만, 작은 습관을 줄이면 다음 달 요금을 더 낮출 수 있어요.";
  els.missionVisual.querySelector("span").textContent = topTip.icon === "❄️" ? "☕" : topTip.icon;
  els.shareMission.textContent = topTip.title;
  els.shareSaving.textContent = `약 ${formatWon(topTip.saving)} 절약`;
  els.shareFunnyLine.textContent = getShareFunnyLine(topTip.saving);
  renderTips(tips);

  els.summaryPyeong.textContent = `${formatPyeong(payload.pyeong)}평`;
  els.summaryArea.textContent = `${payload.area_m2}㎡`;
  els.summaryAircon.textContent = payload.has_aircon ? "있음" : "없음";
  els.summaryHeating.textContent = heatingLabel(payload.heating_type);
  els.summaryInduction.textContent = payload.has_induction ? "사용" : "미사용";
}

function setLoadingStep(step) {
  const titles = [
    "집 정보를 읽고 있어요",
    "마포구 기준과 비교해요",
    "절약 리포트를 만들어요",
  ];
  const copies = [
    "평수와 사용 항목을 요금 예측에 맞게 정리해요.",
    "원룸 1인 가구 기준과 내 조건을 나란히 볼게요.",
    "어디서 아끼면 좋은지 돈으로 바꿔 보여드려요.",
  ];
  els.loadingTitle.textContent = titles[step];
  els.loadingCopy.textContent = copies[step];
  els.loadingSteps.forEach((item, index) => item.classList.toggle("active", index <= step));
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
  els.backButton.disabled = state.index === 0 || current.id === "loading";
  els.nextButton.textContent = current.cta;
  els.nextButton.disabled = current.id === "loading";
  document.querySelector(".screens").scrollTo({ top: 0, behavior: "smooth" });
  if (current.id === "loading") runLoading();
}

async function runLoading() {
  const payload = buildPayload();
  const request = requestPrediction(payload);
  const minimumReadingTime = delay(3300);

  setLoadingStep(0);
  await delay(1050);
  setLoadingStep(1);
  await delay(1050);
  setLoadingStep(2);

  const [prediction] = await Promise.all([request, minimumReadingTime]);
  state.lastPrediction = prediction;
  renderPrediction(prediction);
  goTo(4);
}

function goNext() {
  const current = screens[state.index].id;
  if (current === "area") {
    normalizePyeongInput();
    renderAreaHint();
  }
  if (current === "devices") {
    renderPrediction();
    goTo(3);
    return;
  }
  if (current === "report") {
    goTo(0);
    return;
  }
  goTo(state.index + 1);
}

function bindChoices() {
  document.querySelectorAll("[data-choice]").forEach((group) => {
    group.addEventListener("click", (event) => {
      const button = event.target.closest("button");
      if (!button) return;
      group.querySelectorAll("button").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      state[group.dataset.choice] = button.dataset.value;
      renderPrediction();
    });
  });
}

function setTheme(theme) {
  document.body.dataset.theme = theme;
  localStorage.setItem("mapo-electric-theme", theme);
  els.themeButton.textContent = theme === "dark" ? "라이트" : "다크";
  els.themeButton.setAttribute("aria-label", theme === "dark" ? "라이트 모드로 보기" : "다크 모드로 보기");
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
    saving: els.shareSaving.textContent.trim(),
    funnyLine: els.shareFunnyLine.textContent.trim(),
    visualMain: els.reportVisual.querySelector(".visual-main").textContent.trim(),
    visualSub: els.reportVisual.querySelector(".visual-sub").textContent.trim(),
    missionIcon: els.missionVisual.querySelector("span").textContent.trim(),
    tips: [...els.tipList.querySelectorAll(".tip-card")].slice(0, 3).map((card) => ({
      icon: card.querySelector("b")?.textContent.trim() || "✓",
      title: card.querySelector("strong")?.textContent.trim() || "",
      detail: card.querySelector("p")?.textContent.trim() || "",
      saving: card.querySelector("span")?.textContent.trim() || "",
    })),
    summary: [
      ["평수", els.summaryPyeong.textContent.trim()],
      ["에어컨", els.summaryAircon.textContent.trim()],
      ["난방", els.summaryHeating.textContent.trim()],
      ["인덕션", els.summaryInduction.textContent.trim()],
    ],
  };
}

async function ensureCanvasFonts() {
  if (!("FontFace" in window) || !document.fonts) return;
  const fonts = [
    ["Moneygraphy Rounded", "./assets/fonts/Moneygraphy-Rounded.woff2"],
    ["Moneygraphy Pixel", "./assets/fonts/Moneygraphy-Pixel.woff2"],
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
  return `${weight} ${size}px "Moneygraphy Pixel", "Moneygraphy Rounded", "Malgun Gothic", Arial, sans-serif`;
}

async function createCanvasReportBlob() {
  await ensureCanvasFonts();
  const data = getCanvasReportSnapshot();
  const palette = {
    alert: "#ef4444",
    heating: "#f59e0b",
    cooling: "#3182f6",
    cooking: "#9a5cff",
    steady: "#00a86b",
  };
  const accent = palette[data.profile] || palette.cooling;
  const canvas = document.createElement("canvas");
  const width = 1080;
  const height = 2800;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#f5f7fb";
  ctx.fillRect(0, 0, width, height);
  fillRoundRect(ctx, 42, 42, 996, 2716, 64, "#ffffff");

  ctx.fillStyle = "#eef5ff";
  ctx.beginPath();
  ctx.arc(885, 230, 170, 0, Math.PI * 2);
  ctx.fill();

  fillRoundRect(ctx, 86, 98, 310, 58, 29, "#eef5ff");
  ctx.fillStyle = "#1f6feb";
  ctx.font = reportFont(800, 30);
  ctx.fillText("AI 전기요금 리포트", 116, 138);

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

  fillRoundRect(ctx, 748, 200, 184, 206, 54, "#f5f9ff");
  ctx.fillStyle = accent;
  ctx.font = "92px Apple Color Emoji, Segoe UI Emoji, sans-serif";
  ctx.fillText(data.visualMain, 778, 320);
  fillRoundRect(ctx, 854, 334, 70, 70, 35, accent);
  ctx.fillStyle = "#ffffff";
  ctx.font = reportFont(900, 38);
  ctx.textAlign = "center";
  ctx.fillText(data.visualSub, 889, 381);
  ctx.textAlign = "left";

  fillRoundRect(ctx, 86, 500, 908, 210, 40, "#f7f8fa");
  ctx.fillStyle = "#191f28";
  ctx.font = reportFont(900, 36);
  ctx.fillText("예상 전기요금", 126, 568);
  ctx.fillStyle = "#1f6feb";
  ctx.font = reportNumberFont(900, 88);
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
  fillRoundRect(ctx, 250, 904, 420, 38, 18, "#d7dde5");
  ctx.fillStyle = "#6b7684";
  ctx.fillText(data.baselineBill, 704, 934);
  ctx.fillStyle = "#191f28";
  ctx.font = reportFont(900, 28);
  ctx.fillText("내 예상", 126, 978);
  fillRoundRect(ctx, 250, 952, 580, 38, 18, "#3182f6");
  ctx.fillStyle = "#1f6feb";
  ctx.fillText(data.mineBill, 854, 982);

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
  ctx.fillText("오늘의 절약 1순위", 326, 1288);
  ctx.fillStyle = "#191f28";
  ctx.font = reportFont(900, 38);
  drawTextBlock(ctx, data.mission, 326, 1342, 580, 44, 2);
  fillRoundRect(ctx, 326, 1380, 300, 48, 24, "#dff8ec");
  ctx.fillStyle = "#00a86b";
  ctx.font = reportFont(900, 28);
  ctx.fillText(data.saving, 350, 1413);

  fillRoundRect(ctx, 126, 1466, 828, 56, 28, "#edf6ff");
  ctx.fillStyle = "#1f6feb";
  ctx.font = reportFont(900, 30);
  ctx.textAlign = "center";
  ctx.fillText(data.funnyLine, 540, 1504);
  ctx.textAlign = "left";

  ctx.fillStyle = "#191f28";
  ctx.font = reportFont(900, 42);
  ctx.fillText("추가로 줄이면 좋은 것", 86, 1604);

  data.tips.forEach((tip, index) => {
    const y = 1640 + index * 190;
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
    fillRoundRect(ctx, 770, y + 44, 180, 48, 24, "#dff8ec");
    ctx.fillStyle = "#00a86b";
    ctx.font = reportFont(900, 25);
    ctx.textAlign = "center";
    ctx.fillText(tip.saving, 860, y + 77);
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

async function shareReportImage() {
  try {
    setShareStatus("공유용 이미지를 만들고 있어요.");
    const blob = await createReportImageBlob();
    const extension = blob.type.includes("svg") ? "svg" : "png";
    const file = new File([blob], `mapo-electric-report.${extension}`, { type: blob.type });

    if (navigator.canShare?.({ files: [file] }) && navigator.share) {
      await navigator.share({
        title: "이번 달 전기세 리포트",
        text: "마포구 원룸 1인 가구 전기요금 예측 리포트예요.",
        files: [file],
      });
      setShareStatus("공유창을 열었어요.");
      return;
    }

    setShareStatus("이 브라우저는 바로 공유가 어려워서 이미지로 저장할게요.");
    await saveReportImage();
  } catch (error) {
    if (error.name === "AbortError") {
      setShareStatus("공유를 취소했어요.");
      return;
    }
    console.error("[single-energy] image share failed", error);
    setShareStatus("공유가 막혔어요. 이미지 저장을 먼저 눌러 주세요.");
  }
}

function init() {
  bindChoices();
  els.pyeongInput.addEventListener("input", () => {
    renderAreaHint();
    renderPrediction();
  });
  els.pyeongRange.addEventListener("input", () => {
    els.pyeongInput.value = els.pyeongRange.value;
    renderAreaHint();
    renderPrediction();
  });
  els.pyeongInput.addEventListener("blur", () => {
    normalizePyeongInput();
    renderAreaHint();
    renderPrediction();
  });
  els.backButton.addEventListener("click", () => goTo(state.index - 1));
  els.nextButton.addEventListener("click", goNext);
  els.saveImageButton.addEventListener("click", saveReportImage);
  els.shareImageButton.addEventListener("click", shareReportImage);
  els.themeButton.addEventListener("click", () => {
    setTheme(document.body.dataset.theme === "dark" ? "light" : "dark");
  });
  setTheme(localStorage.getItem("mapo-electric-theme") || "light");
  normalizePyeongInput();
  renderAreaHint();
  renderPrediction();
  goTo(0);

  window.singleEnergyFrontend = {
    buildPayload,
    calculateElectricBill,
    getPredictEndpoint: () => PREDICT_ENDPOINT,
  };
}

init();
