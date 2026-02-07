import { randomBytes } from "node:crypto";

const serverToken = randomBytes(16).toString("hex");

export function getServerToken(): string {
  return serverToken;
}
