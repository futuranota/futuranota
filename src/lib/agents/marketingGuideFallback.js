/**
 * Client-side Marketing Guide fallback when API is unavailable.
 * Mirrors server/agents/marketingGuide.js buildFallbackMarketingGuideReport.
 */

import { pickPrimaryInterestRegion } from "./marketContextBundle.js";

/**
 * @param {'en' | 'es'} lang
 * @param {string} brandName
 * @param {object} detection
 * @param {import("./marketContextBundle.js").MarketContextBundle} [marketContextBundle]
 */
export function buildClientFallbackMarketingGuide(lang, brandName, detection, marketContextBundle) {
  const brand = brandName.trim() || (lang === "es" ? "la marca" : "the brand");
  const launchDate = (detection?.launchDate || detection?.estimatedLaunchDate || "").trim();
  const bundle = marketContextBundle || {};
  const region = pickPrimaryInterestRegion(bundle);

  const brandContextHook = region && bundle.hasVerifiedData
    ? (lang === "es"
      ? `Al entender que tu marca seleccionada **${brand}** muestra mayor índice de interés en **${region}**, esto sugiere que en su próximo movimiento una parte relevante de su audiencia podría concentrarse ahí — úsalo como señal geográfica, no como dato de ventas confirmado.`
      : `Understanding that your selected brand **${brand}** shows its highest interest index in **${region}**, this suggests that for their next move a meaningful share of their audience may cluster there — use it as a geographic signal, not confirmed sales data.`)
    : "";

  const openingHook = lang === "es"
    ? `Este Playbook enseña **cómo usar Futura Nota** paso a paso${bundle.hasVerifiedData ? `, con contexto de la señal de ${brand}` : ""}. No necesitás saber qué producto vas a lanzar.`
    : `This Playbook teaches **how to use Futura Nota** step by step${bundle.hasVerifiedData ? `, with context from the ${brand} signal` : ""}. You don't need to know your product yet.`;

  if (lang === "es") {
    return {
      brandContextHook,
      openingHook,
      calendarGuide: {
        title: "Calendar",
        body: launchDate
          ? `Sincronizá la fecha ${launchDate} con Calendar. Los marcos 7d · 15d · 31d buscan eventos importantes desde esa fecha — un mapa de oportunidades más amplio que el día del launch.`
          : "Cuando tengas fecha (Launch Radar o informe), anclala en Calendar. 7d · 15d · 31d expanden eventos relevantes desde ese punto.",
        action: "Intel → Calendar → probá 15d desde la fecha ancla.",
      },
      forecastGuide: {
        title: "Forecast",
        body: "Forecast cubre ~5 días desde hoy. Úsalo cuando el evento esté cerca — contenido táctico o decisiones según clima.",
        action: "Forecast la semana previa al evento.",
      },
      marketHypeGuide: {
        title: "Market Hype",
        body: `Market Hype muestra dónde ${brand} concentra atención — índice de dónde vive su audiencia y dónde invertir atención cuando tengas contenido.`,
        action: "Intel → Market Hype → estudiar canales.",
      },
      searchIntentGuide: {
        title: "Search Intent",
        body: `Tendencias de búsqueda sobre ${brand}: qué escribir, promocionar y qué pain points resonan.`,
        action: "Top keywords → titulares o preguntas de investigación.",
      },
      youtubeGuide: {
        title: "YouTube",
        body: "Intel → YouTube: pegá links, mirá in-app, tomá notas visuales — tu espacio de aprendizaje.",
        action: "Un video oficial o de cobertura → notas con timestamps.",
      },
      outcomesClosing: "Al conectar estas herramientas podés crear mejores blogs, titulares con más interés en redes, y entender necesidades del público con antelación. Futura Nota detecta eventos futuros.",
      source: "client-fallback",
    };
  }

  return {
    brandContextHook,
    openingHook,
    calendarGuide: {
      title: "Calendar",
      body: launchDate
        ? `Sync ${launchDate} with Calendar. 7d · 15d · 31d frames search important events forward — wider opportunity map than launch day alone.`
        : "When you have a date (Launch Radar or report), anchor it in Calendar. 7d · 15d · 31d expand relevant events from that point.",
      action: "Intel → Calendar → try 15d from anchor date.",
    },
    forecastGuide: {
      title: "Forecast",
      body: "Forecast covers ~5 days from today. Use when the event is close — tactical content or weather-driven decisions.",
      action: "Forecast the week before the event.",
    },
    marketHypeGuide: {
      title: "Market Hype",
      body: `Market Hype shows where ${brand} concentrates attention — where their audience lives and where you should invest attention once you have content.`,
      action: "Intel → Market Hype → study channel mix.",
    },
    searchIntentGuide: {
      title: "Search Intent",
      body: `Search trends for ${brand}: what to write, promote, and which pain points resonate.`,
      action: "Top keywords → headlines or research questions.",
    },
    youtubeGuide: {
      title: "YouTube",
      body: "Intel → YouTube: paste links, watch in-app, take visual notes — your learning space.",
      action: "One official or coverage video → timestamped notes.",
    },
    outcomesClosing: "Connecting these tools helps you write better blogs, craft stronger social headlines, and understand audience needs ahead of time. Futura Nota detects future events.",
    source: "client-fallback",
  };
}
