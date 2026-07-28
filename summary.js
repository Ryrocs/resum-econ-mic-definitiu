// summary.js — Genera el resum econòmic i el guarda a docs/data.json
const fs = require("fs");

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const dataAvui = new Intl.DateTimeFormat("ca-ES", {
  dateStyle: "long",
  timeZone: "Europe/Madrid",
}).format(new Date());

const prompt = `Ets un analista econòmic. Avui és ${dataAvui}. Resumeix les notícies econòmiques més importants dels últims 7 dies.

Cobreix: macroeconomia (inflació, tipus d'interès, PIB, ocupació), Espanya, Europa, economia mundial, mercats i inversions (borsa, renda fixa, divises, matèries primeres), cripto, i alguna curiositat o dada destacada de la setmana.

Cerca informació actual i real a la web abans d'escriure. No t'inventis res.

Respon NOMÉS amb un objecte JSON vàlid, sense cap text abans ni després i sense cometes de codi, amb aquesta estructura EXACTA:
{
  "intro": "una frase que resumeixi el to general de la setmana",
  "sections": [
    {
      "emoji": "📊",
      "title": "Macroeconomia",
      "items": [
        { "headline": "titular curt", "detail": "1-2 frases d'explicació" }
      ]
    }
  ],
  "takeaways": ["punt clau 1", "punt clau 2", "punt clau 3"]
}

Escriu-ho tot en català. Emojis per secció: 📊 Macroeconomia, 🇪🇸 Espanya, 🇪🇺 Europa, 🌍 Món, 💹 Mercats i inversions, ₿ Cripto, 💡 Curiositats.`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function generar() {
  const MAX_INTENTS = 5;
  const ESPERES = [5000, 10000, 20000, 40000, 80000]; // 5s, 10s, 20s, 40s, 80s
  let ultimError;

  for (let intent = 1; intent <= MAX_INTENTS; intent++) {
    try {
      const res = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
        {
          method: "POST",
          headers: { "content-type": "application/json", "x-goog-api-key": GEMINI_API_KEY },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            tools: [{ google_search: {} }],
          }),
        }
      );
      if (res.status === 503 || res.status === 429) {
        throw new Error(`Error de Gemini (${res.status}): ${await res.text()}`);
      }
      if (!res.ok) throw new Error(`Error de Gemini (${res.status}): ${await res.text()}`);
      const data = await res.json();
      const parts = data.candidates?.[0]?.content?.parts || [];
      let text = parts.filter((p) => p.text).map((p) => p.text).join("\n").trim();
      return text.replace(/^```json/i, "").replace(/^```/, "").replace(/```$/, "").trim();
    } catch (e) {
      ultimError = e;
      const esTemporal = /\(503\)|\(429\)/.test(e.message) || e.name === "TypeError" || e.name === "FetchError";
      if (!esTemporal || intent === MAX_INTENTS) throw e;
      const espera = ESPERES[intent - 1];
      console.log(`Intent ${intent}/${MAX_INTENTS} fallit (${e.message}). Reintentant en ${espera / 1000}s...`);
      await sleep(espera);
    }
  }
  throw ultimError;
}

async function main() {
  console.log("Generant resum amb Gemini...");
  const raw = await generar();
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    parsed = { intro: "", sections: [{ emoji: "📈", title: "Resum", items: [{ headline: "", detail: raw }] }], takeaways: [] };
  }
  const out = { date: dataAvui, generatedAt: new Date().toISOString(), ...parsed };
  fs.mkdirSync("docs", { recursive: true });
  fs.writeFileSync("docs/data.json", JSON.stringify(out, null, 2), "utf8");
  console.log("Escrit docs/data.json ✅");

  await enviarNotificacio(out);
}

async function enviarNotificacio(out) {
  const { PUSH_SUBSCRIPTION, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } = process.env;
  if (!PUSH_SUBSCRIPTION || !VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.log("ℹ️ Notificació push omesa: falten variables (PUSH_SUBSCRIPTION / VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY).");
    return;
  }
  try {
    const webpush = require("web-push");
    const subscription = JSON.parse(PUSH_SUBSCRIPTION);
    webpush.setVapidDetails("mailto:xavigo2006@gmail.com", VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    const payload = JSON.stringify({
      title: "📈 Nou resum econòmic",
      body: out.intro || "Ja tens el resum d'aquesta setmana.",
    });
    await webpush.sendNotification(subscription, payload);
    console.log("Notificació push enviada ✅");
  } catch (e) {
    console.log("⚠️ No s'ha pogut enviar la notificació push:", e && e.message ? e.message : e);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
