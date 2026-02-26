import { Hono } from "hono";
import { workspaceApp } from "./workspace.route.js";
import { workspacesApp } from "./workspaces.route.js";

const workspaceRoutes = new Hono().route("/", workspacesApp).route("/", workspaceApp);

export { workspaceRoutes };
