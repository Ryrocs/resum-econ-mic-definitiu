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

async function generar() {
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
  if (!res.ok) throw new Error(`Error de Gemini (${res.status}): ${await res.text()}`);
  const data = await res.json();
  const parts = data.candidates?.[0]?.content?.parts || [];
  let text = parts.filter((p) => p.text).map((p) => p.text).join("\n").trim();
  return text.replace(/^```json/i, "").replace(/^```/, "").replace(/```$/, "").trim();
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
}

main().catch((e) => { console.error(e); process.exit(1); });
