import { dispatchEndpoint } from "../_lib/dispatch.js";
import brandCadence from "../_handlers/analytics/brand-cadence.js";
import campaignDetect from "../_handlers/analytics/campaign-detect.js";
import campaignStudy from "../_handlers/analytics/campaign-study.js";
import horizonScan from "../_handlers/analytics/horizon-scan.js";
import translate from "../_handlers/translate.js";

const routes = {
  "brand-cadence": brandCadence,
  "campaign-detect": campaignDetect,
  "campaign-study": campaignStudy,
  "horizon-scan": horizonScan,
  translate,
};

export default async function handler(req, res) {
  return dispatchEndpoint(req, res, routes);
}
