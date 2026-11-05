# VeganSaathi — Indian Plant-Based Alternatives Guide

**Project:** VeganSaathi  
**Component:** Alternatives Section (`frontend/alternatives/index.html`)  
**Data Engine:** `frontend/js/alternatives-data.js`  
**Page Controller:** `frontend/js/alternatives-page.js`  
**Version:** 1.0.0 (Phase 4 Community Update)

---

## 1. Overview and Purpose

India has one of the world's highest rates of vegetarianism; however, traditional diets are heavily centered on cow and buffalo dairy products—including whole milk (*dudh*), clarified butter (*desi ghee*), yogurt (*dahi*), cottage cheese (*paneer*), fresh cream (*malai*), and sweets (*mithai*).

For college students at SSGMCE Shegaon, local families, and individuals seeking to transition toward a plant-based or lactose-free lifestyle, practical, affordable, and culturally appropriate alternatives are essential.

The **Vegan Alternatives Section** provides an interactive, searchable guide designed specifically around the Indian kitchen, featuring:
- Practical home preparation instructions.
- Real-world cost comparisons (homemade vs. packaged).
- Specific culinary techniques to avoid common pitfalls (e.g., soy milk curdling in tea).
- Fast multi-criteria filtering by category and allergens.

---

## 2. Supported Dietary Categories

| Category | Traditional Food | Key Plant Alternatives | Primary Applications |
| :--- | :--- | :--- | :--- |
| **Dairy Milk** | Cow / Buffalo milk | Soy milk, Oat milk, Peanut-rice milk, Coconut milk | Masala chai, coffee, curries, protein shakes, cereal |
| **Paneer** | Dairy cottage cheese | Firm soy tofu, Pressed peanut-curd paneer | Palak paneer, tikka, bhurji, chili paneer |
| **Dahi / Curd** | Dairy yogurt | Live-cultured peanut curd, Soy yogurt | Raita, kadhi, chaas/buttermilk, marination |
| **Ghee** | Desi cow / buffalo ghee | Cold-pressed sesame/groundnut oil, Plant-based vegan ghee | Tadka, dal-bhat, khichdi, festive sweets |
| **Butter / Makhan** | White butter, salted table butter | Cultured cashew butter, Avocado, Coconut oil spreads | Parathas, pav bhaji, toast, cookies |
| **Chai & Coffee** | Dudh chai, Filter kaapi | Soy milk masala chai, Barista oat milk filter coffee | Daily morning/evening cutting chai, lattes |
| **Sweets & Mithai** | Kheer, Gulab Jamun, Halwa | Almond-coconut kheer, Sweet potato gulab jamun | Diwali, Eid, weddings, festive feasts |
| **Cheese** | Processed cheese, Mozzarella | Tapioca-cashew stretch cheese, Nutritional yeast | Tawa pizza, cheese chili toast, pasta |
| **Cream / Malai** | Fresh milk malai | Silky blended cashew paste (*kaju malai*), Coconut cream | Paneer butter masala gravies, dal makhani, soups |
| **Egg Replacements**| Poultry eggs | Besan / Moong dal chilla, Ground flaxseed gel | Breakfast omelettes, baking brownies, cookies |

---

## 3. Data Schema Specifications

Each alternative entry in `frontend/js/alternatives-data.js` adheres strictly to the following schema:

```typescript
interface VeganAlternative {
  id: string;                      // Unique slug (e.g. "milk-soy")
  category: string;                // Category slug matching ALTERNATIVE_CATEGORIES
  traditionalFood: string;         // Conventional dairy/egg food replaced
  veganAlternative: string;        // Specific plant-based swap and format
  bestUsedFor: string;             // Recommended culinary applications
  notRecommendedFor: string;       // Incompatible preparations or caveats
  availability: string;            // Sourcing guidance (kirana, quick commerce, homemade)
  costComparison: string;          // Cost metric comparing homemade vs. packaged
  preparationTime: string;         // Time required for preparation or cooking
  allergens: string[];             // Common allergens (Soy, Peanuts, Tree Nuts, Gluten)
  nutritionalHighlights: string;  // Protein, vitamins, healthy fats, zero cholesterol
  culinaryTip: string;             // Actionable Indian cooking tip
}
```

---

## 4. Architectural Highlights & User Experience

1. **Lightweight & Fast**: Zero build step or third-party runtime dependencies. Uses native ES modules and browser APIs.
2. **Instant Search**: Client-side filtering queries across traditional food names, alternative names, tips, and ingredients with sub-millisecond response time.
3. **Allergen Protection**: Allows users with nut, soy, or gluten sensitivities to filter out incompatible options instantly.
4. **Responsive Visual Cards**: Styled using VeganSaathi's *Botanical Civic Discovery* design palette, featuring distinct semantic badges and hover elevation.
