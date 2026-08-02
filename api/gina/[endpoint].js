import { dispatchEndpoint } from "../_lib/dispatch.js";
import chat from "../_handlers/gina/chat.js";

const routes = {
  chat,
};

export default async function handler(req, res) {
  return dispatchEndpoint(req, res, routes);
}
