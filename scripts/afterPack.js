// afterPack hook: strip Electron bloat to shrink app size
const fs = require("fs");
const path = require("path");

const KEEP_LOCALES = new Set(["en.lproj", "zh_CN.lproj", "zh-Hans.lproj"]);

exports.default = async function (context) {
  const appDir = context.appOutDir;
  const appPath = path.join(appDir, "MD预览.app");
  const contents = path.join(appPath, "Contents");
  const fw = path.join(contents, "Frameworks");
  const efBase = path.join(fw, "Electron Framework.framework", "Versions", "A");

  let totalSaved = 0;

  // ── 1) Strip unused locales (saves ~38 MB uncompressed) ──
  const resDir = path.join(efBase, "Resources");
  if (fs.existsSync(resDir)) {
    for (const entry of fs.readdirSync(resDir, { withFileTypes: true })) {
      if (entry.isDirectory() && entry.name.endsWith(".lproj") && !KEEP_LOCALES.has(entry.name)) {
        const p = path.join(resDir, entry.name);
        totalSaved += du(p);
        fs.rmSync(p, { recursive: true, force: true });
      }
    }
  }

  // ── 2) Strip SwiftShader (software GPU renderer, ~16 MB) ──
  //    Not needed on Apple Silicon — Metal handles everything.
  const libDir = path.join(efBase, "Libraries");
  if (fs.existsSync(libDir)) {
    for (const name of ["libvk_swiftshader.dylib", "vk_swiftshader_icd.json"]) {
      const p = path.join(libDir, name);
      if (fs.existsSync(p)) {
        totalSaved += fs.statSync(p).size;
        fs.unlinkSync(p);
      }
    }
  }

  // ── 3) Strip crashpad (~1 MB) — not needed for a notes app ──
  const crashpad = path.join(efBase, "Helpers", "chrome_crashpad_handler");
  if (fs.existsSync(crashpad)) {
    totalSaved += fs.statSync(crashpad).size;
    fs.unlinkSync(crashpad);
  }

  // ── 4) Strip Electron Helper (Plugin) ──
  const pluginApp = path.join(fw, "Electron Helper (Plugin).app");
  if (fs.existsSync(pluginApp)) {
    totalSaved += du(pluginApp);
    fs.rmSync(pluginApp, { recursive: true, force: true });
  }

  const savedMB = (totalSaved / 1024 / 1024).toFixed(1);
  console.log(`  • afterPack: stripped ${savedMB} MB total`);
};

function du(p) {
  let total = 0;
  try {
    const stat = fs.statSync(p);
    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(p)) {
        total += du(path.join(p, entry));
      }
    }
    return total + (stat.size || 0);
  } catch {
    return 0;
  }
}
