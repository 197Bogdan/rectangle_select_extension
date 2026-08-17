import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.join(__dirname, "dist");
const popupDir = path.join(__dirname, "src", "popup");

function copy(source, destination) {
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(source, destination);
}

fs.rmSync(distDir, { recursive: true, force: true });
fs.mkdirSync(path.join(distDir, "content"), { recursive: true });

await build({
    entryPoints: [path.join(__dirname, "src", "content", "main.js")],
    bundle: true,
    format: "esm",
    target: ["es2020"],
    minify: true,
    outfile: path.join(distDir, "content", "main.js")
});

await build({
    entryPoints: [path.join(__dirname, "src", "background.js")],
    bundle: true,
    format: "esm",
    target: ["es2020"],
    minify: true,
    outfile: path.join(distDir, "background.js")
});

copy(path.join(__dirname, "manifest.json"), path.join(distDir, "manifest.json"));
copy(path.join(__dirname, "icon.png"), path.join(distDir, "icon.png"));
copy(path.join(popupDir, "popup.html"), path.join(distDir, "popup.html"));
copy(path.join(popupDir, "popup.css"), path.join(distDir, "popup.css"));
copy(path.join(popupDir, "popup.js"), path.join(distDir, "popup.js"));

console.log("Build complete. Extension output is in dist/");