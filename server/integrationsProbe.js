import { createClient } from "@supabase/supabase-js";
import { getDataForSeoAuthHeader, isDataForSeoConfigured } from "./discovery/dataForSeoAuth.js";

/**
 * @typedef {{ ok: boolean, configured: boolean, message: string, latencyMs?: number }} ProbeResult
 */

function ms(start) {
  return Date.now() - start;
}

/**
 * @param {string} [key]
 */
export async function probeGroq(key = process.env.GROQ_API_KEY) {
  if (!key?.trim()) {
    return { ok: false, configured: false, message: "GROQ_API_KEY not set" };
  }
  const start = Date.now();
  try {
    const res = await fetch("https://api.groq.com/openai/v1/models", {
      headers: { Authorization: `Bearer ${key.trim()}` },
    });
    if (!res.ok) {
      const text = await res.text();
      return {
        ok: false,
        configured: true,
        message: `Groq ${res.status}: ${text.slice(0, 120)}`,
        latencyMs: ms(start),
      };
    }
    return { ok: true, configured: true, message: "Groq API reachable", latencyMs: ms(start) };
  } catch (err) {
    return {
      ok: false,
      configured: true,
      message: err instanceof Error ? err.message : "Groq probe failed",
      latencyMs: ms(start),
    };
  }
}

export async function probeSerper(key = process.env.SERPAPI_KEY) {
  if (!key?.trim()) {
    return { ok: false, configured: false, message: "SERPAPI_KEY not set (Serper)" };
  }
  const start = Date.now();
  try {
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": key.trim(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ q: "Futura Nota integration test", num: 1 }),
    });
    if (!res.ok) {
      const text = await res.text();
      return {
        ok: false,
        configured: true,
        message: `Serper ${res.status}: ${text.slice(0, 120)}`,
        latencyMs: ms(start),
      };
    }
    const data = await res.json();
    const hits = (data?.organic?.length ?? 0) + (data?.news?.length ?? 0);
    return {
      ok: true,
      configured: true,
      message: `Serper OK (${hits} hit${hits === 1 ? "" : "s"})`,
      latencyMs: ms(start),
    };
  } catch (err) {
    return {
      ok: false,
      configured: true,
      message: err instanceof Error ? err.message : "Serper probe failed",
      latencyMs: ms(start),
    };
  }
}

export async function probeDataForSeo() {
  if (!isDataForSeoConfigured()) {
    return { ok: false, configured: false, message: "DATAFORSEO_LOGIN not set (base64 of login:password)" };
  }
  const auth = getDataForSeoAuthHeader();
  const start = Date.now();
  try {
    const res = await fetch("https://api.dataforseo.com/v3/appendix/user_data", {
      headers: { Authorization: auth },
    });
    if (!res.ok) {
      const text = await res.text();
      return {
        ok: false,
        configured: true,
        message: `DataForSEO ${res.status}: ${text.slice(0, 120)}`,
        latencyMs: ms(start),
      };
    }
    const data = await res.json();
    const balance = data?.tasks?.[0]?.result?.[0]?.money?.balance;
    const extra = balance != null ? ` · balance $${balance}` : "";
    return {
      ok: true,
      configured: true,
      message: `DataForSEO OK${extra}`,
      latencyMs: ms(start),
    };
  } catch (err) {
    return {
      ok: false,
      configured: true,
      message: err instanceof Error ? err.message : "DataForSEO probe failed",
      latencyMs: ms(start),
    };
  }
}

export async function probeApify(token = process.env.APIFY_API_TOKEN) {
  if (!token?.trim()) {
    return { ok: false, configured: false, message: "APIFY_API_TOKEN not set" };
  }
  const start = Date.now();
  try {
    const res = await fetch(
      `https://api.apify.com/v2/users/me?token=${encodeURIComponent(token.trim())}`,
    );
    if (!res.ok) {
      const text = await res.text();
      return {
        ok: false,
        configured: true,
        message: `Apify ${res.status}: ${text.slice(0, 120)}`,
        latencyMs: ms(start),
      };
    }
    const data = await res.json();
    const username = data?.data?.username || "account";
    const actor = process.env.APIFY_SOCIAL_ACTOR_ID?.trim() || "apidojo~tweet-scraper";
    return {
      ok: true,
      configured: true,
      message: `Apify OK (${username}) · actor ${actor}`,
      latencyMs: ms(start),
    };
  } catch (err) {
    return {
      ok: false,
      configured: true,
      message: err instanceof Error ? err.message : "Apify probe failed",
      latencyMs: ms(start),
    };
  }
}

export async function probeOpenWeather(key = process.env.OPENWEATHER_API_KEY) {
  if (!key?.trim()) {
    return { ok: false, configured: false, message: "OPENWEATHER_API_KEY not set" };
  }
  const city = process.env.WEATHER_DEFAULT_CITY?.trim() || "New York,US";
  const start = Date.now();
  try {
    const url = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(city)}&appid=${key.trim()}&units=imperial&cnt=1`;
    const res = await fetch(url);
    if (!res.ok) {
      const text = await res.text();
      return {
        ok: false,
        configured: true,
        message: `OpenWeather ${res.status}: ${text.slice(0, 120)}`,
        latencyMs: ms(start),
      };
    }
    const data = await res.json();
    const name = data?.city?.name || city;
    return {
      ok: true,
      configured: true,
      message: `OpenWeather OK (${name})`,
      latencyMs: ms(start),
    };
  } catch (err) {
    return {
      ok: false,
      configured: true,
      message: err instanceof Error ? err.message : "OpenWeather probe failed",
      latencyMs: ms(start),
    };
  }
}

function getSupabaseConfig() {
  const url = (
    process.env.SUPABASE_PROJECT_URL
    || process.env.VITE_SUPABASE_URL
    || ""
  ).trim();
  const key = (
    process.env.SUPABASE_ANON_KEY
    || process.env.VITE_SUPABASE_ANON_KEY
    || ""
  ).trim();
  return { url, key };
}

export async function probeSupabase() {
  const { url, key } = getSupabaseConfig();
  if (!url || !key) {
    return {
      ok: false,
      configured: false,
      message: "SUPABASE_PROJECT_URL / SUPABASE_ANON_KEY not set",
    };
  }
  const start = Date.now();
  const supabase = createClient(url, key);
  const checks = [];

  const { error: profilesErr } = await supabase
    .from("profiles")
    .select("tokens_balance, campaign_live_used")
    .limit(1);
  if (profilesErr) {
    checks.push(`profiles: ${profilesErr.message}`);
  } else {
    checks.push("profiles.tokens_balance OK");
  }

  const { error: studiesErr } = await supabase
    .from("campaign_studies")
    .select("id")
    .limit(1);
  if (studiesErr) {
    checks.push(`campaign_studies: ${studiesErr.message}`);
  } else {
    checks.push("campaign_studies OK");
  }

  const { error: weatherErr } = await supabase
    .from("weather_cache")
    .select("cache_key")
    .limit(1);
  if (weatherErr) {
    checks.push(`weather_cache: ${weatherErr.message}`);
  } else {
    checks.push("weather_cache OK");
  }

  const ok = !profilesErr && !studiesErr && !weatherErr;
  return {
    ok,
    configured: true,
    message: checks.join(" · "),
    latencyMs: ms(start),
  };
}

/** @param {{ live?: boolean }} [opts] live=true runs paid API calls (steps 1-5) */
export async function runAllIntegrationProbes(opts = {}) {
  const live = opts.live !== false;
  const groq = live ? await probeGroq() : statusOnly("GROQ_API_KEY", process.env.GROQ_API_KEY);
  const serper = live ? await probeSerper() : statusOnly("SERPAPI_KEY", process.env.SERPAPI_KEY);
  const dataforseo = live
    ? await probeDataForSeo()
    : statusOnly("DATAFORSEO", isDataForSeoConfigured());
  const apify = live ? await probeApify() : statusOnly("APIFY_API_TOKEN", process.env.APIFY_API_TOKEN);
  const openweather = live
    ? await probeOpenWeather()
    : statusOnly("OPENWEATHER_API_KEY", process.env.OPENWEATHER_API_KEY);
  const supabase = await probeSupabase();

  const steps = { groq, serper, dataforseo, apify, openweather, supabase };
  const allOk = Object.values(steps).every((s) => s.ok);

  return {
    ok: allOk,
    steps,
    routes: {
      campaignStudy: "/api/analytics/campaign-study",
      intelOverview: "/api/intel/overview",
      weatherForecast: "/api/weather/forecast",
      horizonScan: "/api/analytics/horizon-scan",
    },
  };
}

/**
 * @param {string} label
 * @param {unknown} configured
 * @returns {ProbeResult}
 */
function statusOnly(label, configured) {
  return configured
    ? { ok: true, configured: true, message: `${label} set (skipped live probe)` }
    : { ok: false, configured: false, message: `${label} not set` };
}
