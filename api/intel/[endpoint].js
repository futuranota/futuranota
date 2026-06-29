import { dispatchEndpoint } from "../_lib/dispatch.js";
import overview from "../_handlers/intel/overview.js";
import models from "../_handlers/intel/models.js";

const routes = {
  overview,
  models,
};

export default async function handler(req, res) {
  return dispatchEndpoint(req, res, routes);
}
