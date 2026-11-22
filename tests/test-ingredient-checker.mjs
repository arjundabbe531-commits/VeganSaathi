/* ==========================================================================
   VeganSaathi — tests/test-ingredient-checker.mjs
   ============================================================================
   Unit verification suite for Indian Dietary Ingredient Compass data & rules.
   ========================================================================== */

import test from "node:test";
import assert from "node:assert/strict";
import { INGREDIENT_CATEGORIES, INGREDIENT_ITEMS } from "../frontend/js/ingredient-checker-data.js";

test("Ingredient Compass — category schema and uniqueness", () => {
  assert.ok(Array.isArray(INGREDIENT_CATEGORIES), "Categories should be an array");
  assert.ok(INGREDIENT_CATEGORIES.length >= 5, "Should have at least 5 categories");

  const catIds = new Set();
  for (const cat of INGREDIENT_CATEGORIES) {
    assert.ok(cat.id, "Category must have an id");
    assert.ok(cat.label, "Category must have a label");
    assert.ok(cat.icon, "Category must have an icon");
    assert.equal(catIds.has(cat.id), false, `Duplicate category id: ${cat.id}`);
    catIds.add(cat.id);
  }
});

test("Ingredient Compass — items validity and required fields", () => {
  assert.ok(Array.isArray(INGREDIENT_ITEMS), "Items must be an array");
  assert.ok(INGREDIENT_ITEMS.length >= 15, "Should have at least 15 curated Indian ingredients");

  const allowedStatuses = new Set(["non-vegan", "caution", "vegan-safe"]);
  const validCategoryIds = new Set(INGREDIENT_CATEGORIES.map(c => c.id));
  validCategoryIds.delete("all"); // 'all' is a filter-only key, items must have a real category

  const itemIds = new Set();

  for (const item of INGREDIENT_ITEMS) {
    assert.ok(item.id, `Item must have an id: ${JSON.stringify(item)}`);
    assert.equal(itemIds.has(item.id), false, `Duplicate item id: ${item.id}`);
    itemIds.add(item.id);

    assert.ok(typeof item.name === "string" && item.name.trim().length > 0, `Item ${item.id} has invalid name`);
    assert.ok(validCategoryIds.has(item.category), `Item ${item.id} has invalid category: ${item.category}`);
    assert.ok(allowedStatuses.has(item.status), `Item ${item.id} has invalid status: ${item.status}`);
    assert.ok(typeof item.description === "string" && item.description.length > 10, `Item ${item.id} missing description`);
    assert.ok(typeof item.chefAdviceEn === "string" && item.chefAdviceEn.length > 5, `Item ${item.id} missing English chef advice`);
    assert.ok(typeof item.chefAdviceMr === "string" && item.chefAdviceMr.length > 5, `Item ${item.id} missing Marathi chef advice`);
    assert.ok(typeof item.alternative === "string" && item.alternative.length > 0, `Item ${item.id} missing alternative`);
  }
});

test("Ingredient Compass — Maharashtra traditional staples classification", () => {
  const ghee = INGREDIENT_ITEMS.find(i => i.id === "desi-ghee");
  assert.ok(ghee, "Desi ghee must be present");
  assert.equal(ghee.status, "non-vegan", "Desi ghee must be non-vegan");
  assert.ok(ghee.marathiName.includes("तूप"), "Desi ghee must have Marathi translation");

  const paneer = INGREDIENT_ITEMS.find(i => i.id === "paneer");
  assert.ok(paneer, "Paneer must be present");
  assert.equal(paneer.status, "non-vegan", "Paneer must be non-vegan");

  const bhakri = INGREDIENT_ITEMS.find(i => i.id === "bhakri");
  assert.ok(bhakri, "Bhakri must be present");
  assert.equal(bhakri.status, "vegan-safe", "Bhakri must be vegan-safe");

  const peanutCurd = INGREDIENT_ITEMS.find(i => i.id === "peanut-curd");
  assert.ok(peanutCurd, "Peanut curd must be present");
  assert.equal(peanutCurd.status, "vegan-safe", "Peanut curd must be vegan-safe");

  const vark = INGREDIENT_ITEMS.find(i => i.id === "silver-vark");
  assert.ok(vark, "Silver vark must be present");
  assert.equal(vark.status, "caution", "Silver vark must be caution due to traditional animal gut preparation");

  const naan = INGREDIENT_ITEMS.find(i => i.id === "naan-bread");
  assert.ok(naan, "Naan must be present");
  assert.equal(naan.status, "caution", "Naan must be caution due to butter brushing and curd/milk in dough");
});
