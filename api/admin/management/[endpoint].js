import { dispatchEndpoint } from "../../_lib/dispatch.js";
import overview from "../../_handlers/admin/management-overview.js";
import integration from "../../_handlers/admin/management-integration.js";

const routes = {
  overview,
  integration,
};

export default async function handler(req, res) {
  return dispatchEndpoint(req, res, routes);
}
