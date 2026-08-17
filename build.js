import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { build } from "esbuild";
import { ZipArchive } from "archiver";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distDir = path.join(__dirname, "dist");
const popupDir = path.join(__dirname, "src", "popup");
const zipPath = path.join(__dirname, "rectangle_select_release.zip");

function copy(source, destination) {
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(source, destination);
}

// Clean dist
fs.rmSync(distDir, { recursive: true, force: true });
fs.mkdirSync(path.join(distDir, "content"), { recursive: true });

// Build content script
await build({
    entryPoints: [
        path.join(__dirname, "src", "content", "main.js")
    ],
    bundle: true,
    format: "esm",
    target: ["es2020"],
    minify: false,
    outfile: path.join(distDir, "content", "main.js")
});

// Build background script
await build({
    entryPoints: [
        path.join(__dirname, "src", "background.js")
    ],
    bundle: true,
    format: "esm",
    target: ["es2020"],
    minify: true,
    outfile: path.join(distDir, "background.js")
});

// Copy static files
copy(
    path.join(__dirname, "manifest.json"),
    path.join(distDir, "manifest.json")
);

copy(
    path.join(__dirname, "icon.png"),
    path.join(distDir, "icon.png")
);

copy(
    path.join(popupDir, "popup.html"),
    path.join(distDir, "popup.html")
);

copy(
    path.join(popupDir, "popup.css"),
    path.join(distDir, "popup.css")
);

copy(
    path.join(popupDir, "popup.js"),
    path.join(distDir, "popup.js")
);

// Create ZIP
await new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);

    const archive = new ZipArchive({
        zlib: { level: 9 }
    });

    output.on("close", () => {
        console.log(`${archive.pointer()} total bytes`);
        resolve();
    });

    output.on("error", reject);

    archive.on("warning", (err) => {
        if (err.code === "ENOENT") {
            console.warn(err);
        } else {
            reject(err);
        }
    });

    archive.on("error", reject);

    // Pipe archive data to the ZIP file
    archive.pipe(output);

    // Put the contents of dist at the root of the ZIP
    archive.directory(distDir, false);

    // Finalize the archive
    archive.finalize();
});

console.log("Build complete.");
console.log(`Extension output: ${distDir}`);
console.log(`ZIP: ${zipPath}`);