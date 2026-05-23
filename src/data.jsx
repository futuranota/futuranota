/* data.jsx — Voltway Arc seed data
 *
 * Campaign data is structured as a set of typed "entities" so that
 * "Insert Blueprint" can split an AI note into individual typed
 * (text/date/metric) notes and group them into a single Blueprint.
 */

/** Demo / seed reference date (campaign fixtures). UI "today" uses getToday(). */
const TODAY = new Date(2026, 4, 20); // May 20, 2026

function getToday() {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

function addDays(d, days) {
  const base = d instanceof Date ? d : new Date(d);
  return new Date(base.getFullYear(), base.getMonth(), base.getDate() + days);
}

/** Timeline window: days from today → end, not counting today in the span (e.g. 21→29 = 8d). */
function timelineWindowDays(minD, maxD, today) {
  if (!minD || !maxD) return { winStart: minD, winEnd: maxD, winDays: 0 };
  const t0 = today.getTime();
  const minT = minD.getTime();
  const maxT = maxD.getTime();
  if (t0 >= minT && t0 < maxT) {
    return {
      winStart: addDays(today, 1),
      winEnd: maxD,
      winDays: daysBetween(today, maxD),
    };
  }
  return {
    winStart: minD,
    winEnd: maxD,
    winDays: Math.abs(daysBetween(minD, maxD)),
  };
}

const COMPANIES = [
  { id: "voltway",   name: "Voltway",   sector: "Electric Vehicles",   campaigns: 3, signal: 92, status: "ACTIVE" },
  { id: "lumen",     name: "Lumen",     sector: "Consumer Electronics", campaigns: 1, signal: 71, status: "STANDBY" },
  { id: "nimbus",    name: "Nimbus",    sector: "Cloud / AI",          campaigns: 2, signal: 64, status: "STANDBY" },
  { id: "fabrico",   name: "Fabrico",   sector: "Smart Appliances",    campaigns: 0, signal: 22, status: "QUIET" },
  { id: "northgrid", name: "Northgrid", sector: "Energy & Storage",    campaigns: 1, signal: 58, status: "STANDBY" },
  { id: "axion",     name: "Axion",     sector: "Robotics",            campaigns: 2, signal: 81, status: "ACTIVE" },
];

const CAMPAIGN_VOLTWAY = {
  id: "CMP-2026-VW-001",
  name: "Voltway Arc",
  company: "Voltway",
  source: "voltway.com/newsroom",
  verification: 96,
  announcementDate: new Date(2026, 3, 14), // Apr 14
  launchDate: new Date(2026, 6, 8),        // Jul 8
  marketGap: "No premium third-party interior trims aligned with Arc's recycled-cabin aesthetic. 6-month window before OEM saturates the segment.",

  // typed entities — used when AI note → Blueprint
  entities: [
    { title: "Campaign",     dataType: "text", content: "Voltway Arc" },
    { title: "Brand",        dataType: "text", content: "Voltway" },
    { title: "Niche",        dataType: "text", content: "Premium EV · accessories" },
    { title: "Announcement", dataType: "date", content: "2026-04-14" },
    { title: "Days Window",  dataType: "metric", content: { kind: "bridge", unit: "days" } }, // bridge between two dates
    { title: "Launch Day",   dataType: "date", content: "2026-07-08" },
    { title: "Market Gap",   dataType: "text", content: "No premium third-party interior trims aligned with Arc's recycled-cabin aesthetic. 6-month window." },
  ],
};

/* Sample of a SECOND blueprint (alt campaign) so stacking is demonstrable */
const CAMPAIGN_LUMEN = {
  id: "CMP-2026-LM-001",
  name: "Lumen Phone X",
  company: "Lumen",
  source: "lumen.com/press",
  verification: 88,
  announcementDate: new Date(2026, 4, 6), // May 6
  launchDate: new Date(2026, 8, 14),      // Sep 14
  marketGap: "Modular accessory ecosystem unexplored. 4-month window pre-launch.",
  entities: [
    { title: "Campaign",     dataType: "text", content: "Lumen Phone X" },
    { title: "Brand",        dataType: "text", content: "Lumen" },
    { title: "Announcement", dataType: "date", content: "2026-05-06" },
    { title: "Days Window",  dataType: "metric", content: { kind: "bridge", unit: "days" } },
    { title: "Launch Day",   dataType: "date", content: "2026-09-14" },
  ],
};

const INTEL = [
  { id: "IN-01", src: "Electrek",        title: "Arc battery pack assembly photos leak from supplier", category: "news",     confidence: 78 },
  { id: "IN-02", src: "VoltWatch",       title: "0–100 km/h confirmed at 3.4s on Performance trim",    category: "campaign", confidence: 91 },
  { id: "IN-03", src: "EV-Pulse",        title: "Interior teaser images: aluminum dashboard",          category: "news",     confidence: 65 },
  { id: "IN-04", src: "CleanDriveNews",  title: "Sub-$50k base price hinted in earnings call",         category: "campaign", confidence: 72 },
  { id: "IN-05", src: "AutoForge",       title: "Aftermarket suppliers ramping for Arc launch",        category: "news",     confidence: 84 },
  { id: "IN-06", src: "GearRumors",      title: "German textile lab partnership for cabin",            category: "news",     confidence: 58 },
  { id: "IN-07", src: "Voltway IR",      title: "Q2 reservation window opens May 28",                  category: "campaign", confidence: 95 },
  { id: "IN-08", src: "InsideEVs",       title: "Pre-order configurator screenshots circulating",      category: "news",     confidence: 69 },
];

const OVERVIEWS = {
  "IN-01": {
    text: "Supplier photos show 82 kWh module assembly active in Lower Saxony plant. Cell density and pack geometry match leaked Performance trim spec. Production volume aligns with July launch.",
    entities: [
      { title: "Source",          dataType: "text",   content: "Electrek" },
      { title: "Supplier Plant",  dataType: "text",   content: "Lower Saxony" },
      { title: "Battery Capacity",dataType: "metric", content: { value: 82, unit: "kWh" } },
      { title: "Confirmed Date",  dataType: "date",   content: "2026-05-18" },
    ],
  },
  "IN-02": {
    text: "Official Voltway press kit confirmed Performance trim hits 3.4s 0–100 km/h via dual-motor configuration. Range penalty: 30 km vs Long Range.",
    entities: [
      { title: "Source",       dataType: "text",   content: "VoltWatch" },
      { title: "0–100 km/h",   dataType: "metric", content: { value: 3.4, unit: "s" } },
      { title: "Range Penalty",dataType: "metric", content: { value: 30, unit: "km" } },
    ],
  },
  "IN-07": {
    text: "Official IR statement: public reservation window opens May 28 at 09:00 CET. $200 fully refundable deposit. Limited to 8,000 units initial batch.",
    entities: [
      { title: "Source",         dataType: "text",   content: "Voltway IR" },
      { title: "Reservation Opens",dataType: "date", content: "2026-05-28" },
      { title: "Deposit",        dataType: "metric", content: { value: 200, unit: "USD" } },
      { title: "Initial Batch",  dataType: "metric", content: { value: 8000, unit: "units" } },
    ],
  },
};

/* default fallback for other signals */
function defaultOverview(signal) {
  return {
    text: `${signal.title}. Confidence ${signal.confidence}%. Source: ${signal.src}.`,
    entities: [
      { title: "Source",     dataType: "text",   content: signal.src },
      { title: "Confidence", dataType: "metric", content: { value: signal.confidence, unit: "%" } },
    ],
  };
}

const URL_EXTRACT_SAMPLE = {
  url: "https://electrek.co/voltway-arc-cabin-materials",
  source: "electrek.co",
  title: "Voltway Arc cabin: full breakdown of recycled materials",
  date: "May 18, 2026",
  summary: "New supplier filings show Voltway has partnered with a German textile lab for the Arc cabin. Materials include reclaimed marine plastics, wool composite, and aluminum extrusions.",
  entities: [
    { title: "Source",     dataType: "text", content: "electrek.co" },
    { title: "Reported",   dataType: "date", content: "2026-05-18" },
    { title: "Cabin Note", dataType: "text", content: "Marine-plastic + wool composite + aluminum extrusions" },
  ],
};

/* ── utilities ─────────────────────────────────────── */

function daysBetween(a, b) {
  const da = (a instanceof Date) ? a : new Date(a);
  const db = (b instanceof Date) ? b : new Date(b);
  return Math.round((db - da) / 86400000);
}

function fmtDate(d, fmt = "long") {
  const dd = (d instanceof Date) ? d : new Date(d);
  if (isNaN(dd)) return String(d);
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  if (fmt === "short") return `${months[dd.getMonth()]} ${dd.getDate()}`;
  if (fmt === "iso")   return `${dd.getFullYear()}-${String(dd.getMonth()+1).padStart(2,"0")}-${String(dd.getDate()).padStart(2,"0")}`;
  return `${months[dd.getMonth()]} ${dd.getDate()}, ${dd.getFullYear()}`;
}

function shortId(prefix = "ND") {
  const s = Math.random().toString(36).toUpperCase().slice(2, 5);
  return `${prefix}-${s}`;
}

/* Blueprint colors — assigned in rotation when blueprints are created */
const BLUEPRINT_COLORS = [
  { id: "mint",   stroke: "#8ee9a3", soft: "rgba(142, 233, 163, 0.10)" },
  { id: "violet", stroke: "#c9b8ff", soft: "rgba(201, 184, 255, 0.10)" },
  { id: "cyan",   stroke: "#7be6e0", soft: "rgba(123, 230, 224, 0.10)" },
  { id: "amber",  stroke: "#ffc56b", soft: "rgba(255, 197, 107, 0.10)" },
];

export {
  TODAY, COMPANIES, CAMPAIGN_VOLTWAY, CAMPAIGN_LUMEN, INTEL, OVERVIEWS, URL_EXTRACT_SAMPLE,
  BLUEPRINT_COLORS,
  daysBetween, fmtDate, shortId, defaultOverview, getToday, addDays, timelineWindowDays,
};
