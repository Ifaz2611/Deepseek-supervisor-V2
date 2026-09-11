/**
 * Vite build script for DeepSeek Memory (Chrome/Chromium only).
 *
 * Builds three bundles: content, background, and injected (MAIN world hook).
 */

import { build } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import {
  copyFileSync,
  mkdirSync,
  existsSync,
  readdirSync,
  statSync,
  readFileSync,
  writeFileSync,
} from "fs";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const distFolderName = "dist";

const sharedResolve = {
  alias: {
    "bds-platform-globals": resolve(__dirname, "src/platform/globals-chrome.js"),
  },
};

const sharedDefine = {
  "process.env.NODE_ENV": '"production"',
};

const builds = [
  // Content Script
  {
    plugins: [svelte()],
    resolve: sharedResolve,
    esbuild: { charset: "ascii" },
    build: {
      emptyOutDir: true,
      outDir: resolve(__dirname, distFolderName),
      rollupOptions: {
        input: resolve(__dirname, "src/content/index.js"),
        output: { format: "iife", entryFileNames: "content.js", assetFileNames: "content.[ext]", inlineDynamicImports: true },
        treeshake: false,
      },
      cssCodeSplit: false,
      minify: true,
      sourcemap: false,
    },
    define: sharedDefine,
  },
  // Background Service Worker
  {
    plugins: [],
    resolve: sharedResolve,
    esbuild: { charset: "ascii" },
    build: {
      emptyOutDir: false,
      outDir: resolve(__dirname, distFolderName),
      rollupOptions: {
        input: resolve(__dirname, "src/background/index.js"),
        output: { format: "iife", entryFileNames: "background.js", inlineDynamicImports: true },
        treeshake: false,
      },
      minify: true,
      sourcemap: false,
    },
    define: sharedDefine,
  },
  // Injected Script (MAIN world)
  {
    plugins: [],
    resolve: sharedResolve,
    esbuild: { charset: "ascii" },
    build: {
      emptyOutDir: false,
      outDir: resolve(__dirname, distFolderName),
      rollupOptions: {
        input: resolve(__dirname, "src/injected/index.js"),
        output: { format: "iife", entryFileNames: "injected.js", inlineDynamicImports: true },
        treeshake: false,
      },
      minify: true,
      sourcemap: false,
    },
    define: sharedDefine,
  },
];

function copyRecursiveSync(src, dest) {
  if (statSync(src).isDirectory()) {
    if (!existsSync(dest)) mkdirSync(dest, { recursive: true });
    readdirSync(src).forEach((child) => copyRecursiveSync(resolve(src, child), resolve(dest, child)));
  } else {
    copyFileSync(src, dest);
  }
}

async function generateIcons(distDir) {
  const svgPath = resolve(__dirname, "icon.svg");
  if (!existsSync(svgPath)) {
    console.warn("icon.svg not found — skipping icon generation.");
    return;
  }
  const sizes = [16, 48, 128];
  for (const size of sizes) {
    try {
      await sharp(svgPath)
        .resize(size, size)
        .png()
        .toFile(resolve(distDir, `icon${size}.png`));
    } catch (err) {
      console.warn(`Icon generation failed for ${size}px:`, err.message);
    }
  }
  console.log("Icons generated: icon16.png, icon48.png, icon128.png");
}

async function run() {
  for (const config of builds) {
    await build({ ...config, configFile: false });
  }

  const distDir = resolve(__dirname, distFolderName);
  const manifestPath = resolve(__dirname, "static/manifest.json");
  writeFileSync(resolve(distDir, "manifest.json"), readFileSync(manifestPath, "utf8"));

  await generateIcons(distDir);

  console.log(`\nBuild complete: ${distFolderName}/`);
}

run().catch((err) => {
  console.error("Build failed:", err);
  process.exit(1);
});
