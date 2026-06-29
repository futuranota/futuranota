import { dispatchEndpoint } from "../_lib/dispatch.js";
import analyze from "../_handlers/agents/analyze.js";
import orchestrate from "../_handlers/agents/orchestrate.js";
import marketingGuide from "../_handlers/agents/marketing-guide.js";
import socialHypeAnalyst from "../_handlers/agents/social-hype-analyst.js";

const routes = {
  analyze,
  orchestrate,
  "marketing-guide": marketingGuide,
  "social-hype-analyst": socialHypeAnalyst,
};

export default async function handler(req, res) {
  return dispatchEndpoint(req, res, routes);
}
