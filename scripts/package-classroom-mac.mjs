import { verifyBundle } from "./verify-bundle.mjs";
import {
  readFile,
  writeFile,
  mkdir,
  mkdtemp,
  cp,
  rm,
  copyFile,
  stat,
} from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import path from "node:path";
const crossBuild = process.argv.includes("--cross-build");
const nativeMac = process.platform === "darwin" && process.arch === "arm64";
if (!nativeMac && !crossBuild)
  throw new Error(
    "Run on an Apple Silicon Mac or GitHub Build classroom Mac ZIP. --cross-build creates an explicitly UNVERIFIED archive only.",
  );
const output = path.resolve("release-classroom");
const app = path.join(output, "mac-arm64/The Permitted World.app");
const bundle = await verifyBundle(path.join(app, "Contents"));
if (nativeMac) {
  const architecture = execFileSync(
    "lipo",
    ["-archs", path.join(app, "Contents/MacOS/The Permitted World")],
    { encoding: "utf8" },
  ).trim();
  if (architecture !== "arm64") throw new Error("Expected ARM64 only");
  execFileSync("codesign", ["--verify", "--deep", "--strict", app], {
    stdio: "inherit",
  });
}
const { version } = JSON.parse(await readFile("package.json", "utf8"));
const rootName = "The-Permitted-World-Classroom-Apple-Silicon";
const filename = `The-Permitted-World-${version}-classroom-macOS-Apple-Silicon-arm64${nativeMac ? "" : "-UNVERIFIED-crossbuild"}.zip`;
await mkdir(output, { recursive: true });
const staging = await mkdtemp(path.join(output, ".classroom-staging-"));
try {
  const folder = path.join(staging, rootName);
  await mkdir(folder);
  if (nativeMac)
    execFileSync("ditto", [app, path.join(folder, "The Permitted World.app")]);
  else
    await cp(app, path.join(folder, "The Permitted World.app"), {
      recursive: true,
      verbatimSymlinks: true,
    });
  await copyFile("docs/CLASSROOM.md", path.join(folder, "课堂使用说明.md"));
  await copyFile("docs/V2.md", path.join(folder, "V2.md"));
  await copyFile("docs/V2.2.md", path.join(folder, "V2.2.md"));
  await copyFile("docs/V3.md", path.join(folder, "V3.md"));
  await copyFile("LICENSE", path.join(folder, "LICENSE.txt"));
  await cp("third-party", path.join(folder, "third-party"), {
    recursive: true,
  });
  await copyFile(
    "public/vision/manifest.json",
    path.join(folder, "model-manifest.json"),
  );
  const validation = {
    ...bundle,
    buildHost: process.platform,
    adHocSignature: nativeMac
      ? "verified by codesign"
      : "NOT VERIFIED; cross-built without macOS signing",
    macInstallation: "not tested on a classroom Mac",
    cameraHardware: "not tested",
    distribution:
      "classroom test only; no Developer ID, notarization or App Store requirement",
  };
  await writeFile(
    path.join(folder, "验证信息.json"),
    JSON.stringify(validation, null, 2) + "\n",
  );
  if (!nativeMac)
    await writeFile(
      path.join(folder, "未在Mac验证-请先阅读.txt"),
      "此 ZIP 是 Linux 交叉构建的备份，不是已验证的 Mac 课堂演示包。未做 macOS 本机 ad-hoc 签名、启动或安装测试。优先使用 GitHub Actions 的 Build classroom Mac ZIP 生成的本机包，并在课堂电脑上预先断网通关。\n",
    );
  const archive = path.join(output, filename);
  // Remove only a previous archive with this exact generated filename.
  await rm(archive, { force: true });
  if (nativeMac)
    execFileSync(
      "ditto",
      ["-c", "-k", "--sequesterRsrc", "--keepParent", folder, archive],
      { stdio: "inherit" },
    );
  else
    execFileSync("zip", ["-q", "-r", "-y", archive, rootName], {
      cwd: staging,
      stdio: "inherit",
    });
  execFileSync("unzip", ["-tq", archive], { stdio: "inherit" });
  const bytes = await readFile(archive);
  const report = {
    filename,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    size: (await stat(archive)).size,
    ...validation,
  };
  await writeFile(
    path.join(output, "classroom-verification.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  await writeFile(
    path.join(output, "SHA256SUMS.txt"),
    `${report.sha256}  ${filename}\n`,
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await rm(staging, { recursive: true, force: true });
}
