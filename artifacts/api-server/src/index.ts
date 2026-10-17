import app from "./app";
import { logger } from "./lib/logger";
import { initializeStore } from "./saqfi/store";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function start() {
await initializeStore();
app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
}
start().catch(() => {
  logger.error("Saqfi startup failed. Check MongoDB configuration and connectivity; no fallback was used.");
  process.exit(1);
});
