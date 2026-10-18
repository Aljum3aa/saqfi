// Builds Saqfi for Vercel using the Build Output API (.vercel/output):
//   static/                 the React app (Vite build)
//   functions/api.func/     the Express API bundled into one Node function
// Routes send /api/* to the function and everything else to the SPA.
import { execSync } from "node:child_process";
import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, ".vercel", "output");
const run = (cmd, env = {}) => execSync(cmd, { cwd: root, stdio: "inherit", env: { ...process.env, ...env } });

await rm(out, { recursive: true, force: true });

// 1) Web app
run(`${process.env.PNPM ?? "pnpm"} --filter @workspace/saqfi run build`, { PORT: "3000", BASE_PATH: "/", NODE_ENV: "production" });
await cp(path.join(root, "artifacts/saqfi/dist/public"), path.join(out, "static"), { recursive: true });

// 2) API as a single bundled function (esbuild comes from the api-server package)
const require = createRequire(path.join(root, "artifacts/api-server/package.json"));
const { build } = require("esbuild");
const fn = path.join(out, "functions", "api.func");
await mkdir(fn, { recursive: true });
await build({
  entryPoints: [path.join(root, "artifacts/api-server/src/vercel.ts")],
  outfile: path.join(fn, "index.mjs"),
  platform: "node", target: "node22", format: "esm", bundle: true,
  define: { "process.env.NODE_ENV": '"production"' },
  external: ["mongodb-client-encryption", "kerberos", "snappy", "@mongodb-js/zstd", "gcp-metadata", "socks", "aws4", "*.node"],
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
  logLevel: "info",
});
await writeFile(path.join(fn, ".vc-config.json"), JSON.stringify({
  runtime: "nodejs22.x", handler: "index.mjs", launcherType: "Nodejs", shouldAddHelpers: false, maxDuration: 30,
}, null, 2));

// 3) Routing
await writeFile(path.join(out, "config.json"), JSON.stringify({
  version: 3,
  routes: [
    { src: "^/api(/.*)?$", dest: "/api" },
    { handle: "filesystem" },
    { src: "/(.*)", dest: "/index.html" },
  ],
}, null, 2));
console.log("Vercel output ready:", out);
