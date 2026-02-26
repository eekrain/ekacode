import { Hono } from "hono";
import { keypointsApp } from "./project-keypoints.route.js";
import { projectApp } from "./project.route.js";

const projectRoutes = new Hono().route("/", projectApp).route("/", keypointsApp);

export { projectRoutes };
