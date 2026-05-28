/** Map intel source labels to domains for favicons and URLs. */
const SOURCE_DOMAINS = {
  Electrek: "electrek.co",
  VoltWatch: "voltwatch.com",
  "EV-Pulse": "evpulse.com",
  CleanDriveNews: "cleandrivenews.com",
  AutoForge: "autoforge.com",
  GearRumors: "gearrumors.com",
  "Voltway IR": "voltway.com",
  InsideEVs: "insideevs.com",
};

export function citationSourceDomain(source) {
  if (!source) return "example.com";
  if (SOURCE_DOMAINS[source]) return SOURCE_DOMAINS[source];
  const slug = source.toLowerCase().replace(/[^a-z0-9]+/g, "");
  return slug ? `${slug}.com` : "example.com";
}

export function citationFaviconUrl(domain) {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`;
}

export function citationPageUrl(source, id) {
  const domain = citationSourceDomain(source);
  const path = encodeURIComponent(id || "article");
  return `https://${domain}/${path}`;
}
