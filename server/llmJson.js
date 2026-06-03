/**
 * Minimal Groq / Gemini JSON completion helpers for dev API routes.
 */

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";

const GEMINI_MODEL = "gemini-2.0-flash";

/**
 * @param {string} prompt
 * @param {{ system?: string }} [options]
 */
export async function completeJsonWithGroq(prompt, options = {}) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        ...(options.system
          ? [{ role: "system", content: options.system }]
          : []),
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Groq ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  const raw = data?.choices?.[0]?.message?.content;
  if (!raw) throw new Error("Groq returned empty content");
  return JSON.parse(raw);
}

/**
 * @param {string} prompt
 * @param {{ system?: string }} [options]
 */
export async function completeJsonWithGemini(prompt, options = {}) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) return null;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
  const parts = [];
  if (options.system) {
    parts.push({ text: options.system });
  }
  parts.push({ text: prompt });

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!raw) throw new Error("Gemini returned empty content");
  return JSON.parse(raw);
}

/**
 * @param {string} prompt
 * @param {{ system?: string }} [options]
 */
export async function completeJson(prompt, options = {}) {
  const groq = await completeJsonWithGroq(prompt, options);
  if (groq) return { provider: "groq", data: groq };
  const gemini = await completeJsonWithGemini(prompt, options);
  if (gemini) return { provider: "gemini", data: gemini };
  return null;
}
