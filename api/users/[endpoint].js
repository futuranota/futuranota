import { dispatchEndpoint } from "../_lib/dispatch.js";
import me from "../_handlers/users/me.js";

const routes = {
  me,
};

export default async function handler(req, res) {
  return dispatchEndpoint(req, res, routes);
}
