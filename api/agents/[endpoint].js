import { dispatchEndpoint } from "../_lib/dispatch.js";
import analyze from "../_handlers/agents/analyze.js";
import orchestrate from "../_handlers/agents/orchestrate.js";
import marketingGuide from "../_handlers/agents/marketing-guide.js";

const routes = {
  analyze,
  orchestrate,
  "marketing-guide": marketingGuide,
};

export default async function handler(req, res) {
  return dispatchEndpoint(req, res, routes);
}
