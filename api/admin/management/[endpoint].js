import { dispatchEndpoint } from "../../_lib/dispatch.js";
import overview from "../../_handlers/admin/management-overview.js";
import integration from "../../_handlers/admin/management-integration.js";
import gastos from "../../_handlers/admin/management-gastos.js";
import quotas from "../../_handlers/admin/management-quotas.js";
import users from "../../_handlers/admin/management-users.js";

const routes = {
  overview,
  integration,
  gastos,
  quotas,
  users,
};

export default async function handler(req, res) {
  return dispatchEndpoint(req, res, routes);
}
