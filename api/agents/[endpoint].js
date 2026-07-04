import { dispatchEndpoint } from "../_lib/dispatch.js";
import analyze from "../_handlers/agents/analyze.js";
import orchestrate from "../_handlers/agents/orchestrate.js";
import marketingGuide from "../_handlers/agents/marketing-guide.js";
import socialHypeAnalyst from "../_handlers/agents/social-hype-analyst.js";
import contentCreator from "../_handlers/agents/content-creator.js";
import salesAgent from "../_handlers/agents/sales-agent.js";
import deepResearcher from "../_handlers/agents/deep-researcher.js";

const routes = {
  analyze,
  orchestrate,
  "marketing-guide": marketingGuide,
  "social-hype-analyst": socialHypeAnalyst,
  "content-creator": contentCreator,
  "sales-agent": salesAgent,
  "deep-researcher": deepResearcher,
};

export default async function handler(req, res) {
  return dispatchEndpoint(req, res, routes);
}
