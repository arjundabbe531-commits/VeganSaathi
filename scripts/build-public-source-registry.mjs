import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.join(repoRoot, "scripts", "data-pipeline", "source_registry.json");
const outputPath = path.join(repoRoot, "frontend", "data", "source_registry.json");

const PUBLIC_FIELDS = [
  "id", "name", "provider", "documentation_url", "licence_name", "licence_url",
  "attribution_requirement", "dataset_version", "cost_status", "review_status",
  "adapter_implemented", "adapter_file", "owner_action_required"
];

export function projectPublicSourceRegistry(registry) {
  if (!registry || !Array.isArray(registry.sources)) {
    throw new TypeError("Source registry must contain a sources array");
  }
  return {
    version: registry._meta?.version || "1",
    sources: registry.sources.map((source) => Object.fromEntries(
      PUBLIC_FIELDS.filter((key) => Object.hasOwn(source, key)).map((key) => [key, source[key]])
    ))
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const registry = JSON.parse(await readFile(sourcePath, "utf8"));
  const projection = projectPublicSourceRegistry(registry);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(projection, null, 2)}\n`, "utf8");
  console.log(`Wrote ${projection.sources.length} public source summaries to frontend/data/source_registry.json`);
}
