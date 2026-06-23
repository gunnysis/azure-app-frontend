const BACKEND_BASE =
  "https://app-mlbackend-prod-kc-01-h4a6byekfzhkcday.koreacentral-01.azurewebsites.net";

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      ...JSON_HEADERS,
      ...(init.headers || {}),
    },
  });
}

async function readJson(request) {
  const text = await request.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function safeText(value, maxLength = 800) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: JSON_HEADERS });
}

export async function onRequestPost({ request, env }) {
  const body = await readJson(request);
  if (body === undefined) {
    return json(
      {
        error: "Invalid JSON body",
        detail: "프론트는 Content-Type: application/json 형식의 JSON으로 요청해야 합니다.",
      },
      { status: 400 },
    );
  }

  const backendBase = (env.PREDICT_API_BASE || BACKEND_BASE).replace(/\/$/, "");
  const backendResponse = await fetch(`${backendBase}/api/v1/estimate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });

  const responseText = await backendResponse.text();
  let data;
  try {
    data = responseText ? JSON.parse(responseText) : {};
  } catch {
    data = { raw: safeText(responseText) };
  }

  if (!backendResponse.ok) {
    return json(
      {
        error: "Prediction backend failed",
        status: backendResponse.status,
        detail: data,
      },
      { status: backendResponse.status },
    );
  }

  return json(data);
}
