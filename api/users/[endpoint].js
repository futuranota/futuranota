import { dispatchEndpoint } from "../_lib/dispatch.js";
import me from "../_handlers/users/me.js";
import deleteAccount from "../_handlers/users/delete-account.js";

const routes = {
  me,
  "delete-account": deleteAccount,
};

export default async function handler(req, res) {
  return dispatchEndpoint(req, res, routes);
}
