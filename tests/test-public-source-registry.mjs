import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { projectPublicSourceRegistry } from "../scripts/build-public-source-registry.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("public registry projection contains only explicitly allowlisted source fields", async () => {
  const registry = JSON.parse(await readFile(path.join(root, "scripts/data-pipeline/source_registry.json"), "utf8"));
  const projection = projectPublicSourceRegistry(registry);
  const publicFile = JSON.parse(await readFile(path.join(root, "frontend/data/source_registry.json"), "utf8"));
  assert.deepEqual(publicFile, projection);
  for (const source of projection.sources) {
    assert.ok(source.id && source.name && source.review_status);
    assert.equal(Object.hasOwn(source, "notes"), false);
    assert.equal(Object.hasOwn(source, "retrieval_method"), false);
    assert.equal(Object.hasOwn(source, "free_quota"), false);
    assert.equal(Object.hasOwn(source, "storage_restrictions"), false);
  }
});
