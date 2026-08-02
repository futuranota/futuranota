import { dispatchEndpoint } from "../_lib/dispatch.js";
import translate from "../_handlers/translate.js";
import proxy from "../_handlers/proxy.js";
import usageLog from "../_handlers/usage-log.js";
import weatherForecast from "../_handlers/weather-forecast.js";
import healthIntegrations from "../_handlers/health-integrations.js";
import events from "../_handlers/events.js";

const routes = {
  translate,
  proxy,
  "usage-log": usageLog,
  "weather-forecast": weatherForecast,
  "health-integrations": healthIntegrations,
  events,
};

export default async function handler(req, res) {
  return dispatchEndpoint(req, res, routes);
}
