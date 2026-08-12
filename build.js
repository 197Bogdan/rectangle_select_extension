const esbuild = require("esbuild");

esbuild.build({
    entryPoints: ["src/content/main.js"],
    bundle: true,
    outfile: "dist/content/main.js",
    format: "iife",
    target: ["chrome100", "firefox100"],
}).catch(() => process.exit(1));