/* ==========================================================================
   VeganSaathi — tests/test-alternatives.mjs
   Unit tests for Indian Vegan Alternatives dataset and query engine.
   ========================================================================== */

import assert from "node:assert/strict";
import {
  ALTERNATIVE_CATEGORIES,
  VEGAN_ALTERNATIVES,
  getAllAlternatives,
  getAlternativesByCategory,
  searchAlternatives
} from "../frontend/js/alternatives-data.js";

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`PASS - ${name}`);
  } catch (err) {
    failed++;
    console.error(`FAIL - ${name}`);
    console.error(err);
  }
}

console.log("Starting Vegan Alternatives Tests...\n");

// 1. Categories Coverage
test("categories: defines at least 10 culinary categories plus 'all'", () => {
  assert.ok(ALTERNATIVE_CATEGORIES.length >= 11, "Must contain 'all' + at least 10 categories");
  const slugs = ALTERNATIVE_CATEGORIES.map(c => c.slug);
  assert.ok(slugs.includes("all"));
  assert.ok(slugs.includes("milk"));
  assert.ok(slugs.includes("paneer"));
  assert.ok(slugs.includes("dahi"));
  assert.ok(slugs.includes("ghee"));
  assert.ok(slugs.includes("butter"));
  assert.ok(slugs.includes("chai-coffee"));
  assert.ok(slugs.includes("sweets"));
  assert.ok(slugs.includes("cheese"));
  assert.ok(slugs.includes("malai"));
  assert.ok(slugs.includes("eggs"));
});

// 2. Schema Integrity
test("schema: every alternative contains all 11 required fields", () => {
  const all = getAllAlternatives();
  assert.ok(all.length >= 15, "Should have a substantial library of alternatives");

  all.forEach((item, index) => {
    assert.ok(typeof item.id === "string" && item.id.length > 0, `Item ${index} must have valid id`);
    assert.ok(typeof item.category === "string" && item.category.length > 0, `Item ${index} must have category`);
    assert.ok(typeof item.traditionalFood === "string" && item.traditionalFood.length > 0, `Item ${index} must have traditionalFood`);
    assert.ok(typeof item.veganAlternative === "string" && item.veganAlternative.length > 0, `Item ${index} must have veganAlternative`);
    assert.ok(typeof item.bestUsedFor === "string" && item.bestUsedFor.length > 0, `Item ${index} must have bestUsedFor`);
    assert.ok(typeof item.availability === "string" && item.availability.length > 0, `Item ${index} must have availability`);
    assert.ok(typeof item.costComparison === "string" && item.costComparison.length > 0, `Item ${index} must have costComparison`);
    assert.ok(typeof item.preparationTime === "string" && item.preparationTime.length > 0, `Item ${index} must have preparationTime`);
    assert.ok(Array.isArray(item.allergens), `Item ${index} allergens must be an array`);
    assert.ok(typeof item.nutritionalHighlights === "string" && item.nutritionalHighlights.length > 0, `Item ${index} must have nutritionalHighlights`);
    assert.ok(typeof item.culinaryTip === "string" && item.culinaryTip.length > 0, `Item ${index} must have culinaryTip`);
  });
});

// 3. Category Filtering
test("getAlternativesByCategory: correctly filters by slug", () => {
  const milks = getAlternativesByCategory("milk");
  assert.ok(milks.length > 0);
  assert.ok(milks.every(m => m.category === "milk"));

  const dahi = getAlternativesByCategory("dahi");
  assert.ok(dahi.length > 0);
  assert.ok(dahi.every(d => d.category === "dahi"));

  const all = getAlternativesByCategory("all");
  assert.equal(all.length, VEGAN_ALTERNATIVES.length);
});

// 4. Search and Keyword Querying
test("searchAlternatives: matches traditional food keywords", () => {
  const paneerResults = searchAlternatives("paneer");
  assert.ok(paneerResults.length > 0);
  assert.ok(paneerResults.some(r => r.id === "paneer-tofu"));

  const chaiResults = searchAlternatives("chai");
  assert.ok(chaiResults.length > 0);
  assert.ok(chaiResults.some(r => r.id === "chai-soy"));
});

test("searchAlternatives: matches culinary tips and ingredients", () => {
  const turmericResults = searchAlternatives("turmeric");
  assert.ok(turmericResults.length > 0);

  const jaggeryResults = searchAlternatives("cardamom");
  assert.ok(jaggeryResults.length > 0);
});

// 5. Allergen Filtering
test("searchAlternatives: excludes allergen when requested", () => {
  const allWithoutSoy = searchAlternatives("", "all", "Soy");
  assert.ok(allWithoutSoy.length > 0);
  assert.ok(allWithoutSoy.every(item => !item.allergens.some(a => a.toLowerCase().includes("soy"))));

  const allWithoutPeanut = searchAlternatives("", "all", "Peanut");
  assert.ok(allWithoutPeanut.length > 0);
  assert.ok(allWithoutPeanut.every(item => !item.allergens.some(a => a.toLowerCase().includes("peanut"))));
});

console.log("\n========================================");
console.log(`Alternatives Tests: ${passed} passed, ${failed} failed.`);
console.log("========================================\n");

if (failed > 0) {
  process.exit(1);
}
