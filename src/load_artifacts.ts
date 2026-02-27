import fs from "node:fs";
import path from "node:path";

export type ArtifactIndex = {
  screenshots: string[];
  traces: string[];
  videos: string[];
};

function listFilesRecursive(dir: string): string[] {
  const out: string[] = [];
  if (!dir || !fs.existsSync(dir)) return out;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...listFilesRecursive(p));
    else out.push(p);
  }
  return out;
}

export function indexArtifacts(artifactsDir?: string): ArtifactIndex {
  const files = artifactsDir ? listFilesRecursive(artifactsDir) : [];
  const screenshots = files.filter(f => /\.(png|jpg|jpeg|webp)$/i.test(f));
  const traces = files.filter(f =>
    (f.toLowerCase().includes("trace") && /\.(zip|json)$/i.test(f)) ||
    (f.toLowerCase().endsWith(".zip") && f.toLowerCase().includes("trace"))
  );
  const videos = files.filter(f => /\.(webm|mp4)$/i.test(f));

  return { screenshots, traces, videos };
}
