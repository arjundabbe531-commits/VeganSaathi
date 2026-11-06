/* ==========================================================================
   VeganSaathi — alternatives-data.js
   Comprehensive Indian Vegan Alternatives Reference Dataset.
   Designed specifically for students, families, and foodies in India
   transitioning to or exploring plant-based living.
   ========================================================================== */

export const ALTERNATIVE_CATEGORIES = [
  { slug: "all", name: "All Categories", icon: "✨" },
  { slug: "milk", name: "Dairy Milk", icon: "🥛", description: "Replacements for cow and buffalo milk in chai, coffee, and curries" },
  { slug: "paneer", name: "Paneer / Cottage Cheese", icon: "🧀", description: "High-protein textures for palak paneer, tikka, and bhurji" },
  { slug: "dahi", name: "Dahi / Curd / Yogurt", icon: "🥣", description: "Probiotic, creamy curds for raita, kadhi, chaas, and marination" },
  { slug: "ghee", name: "Ghee / Clarified Butter", icon: "🫙", description: "Aromatic cooking fats for tadka, khichdi, and festive roasting" },
  { slug: "butter", name: "Butter / Makhan", icon: "🧈", description: "Spreads and baking fats for pav bhaji, parathas, and toast" },
  { slug: "chai-coffee", name: "Chai & Coffee", icon: "☕", description: "Curdle-free morning brews and rich filter coffees" },
  { slug: "sweets", name: "Mithai & Desserts", icon: "🍨", description: "Plant-based festive sweets: kheer, halwa, gulab jamun, and ladoos" },
  { slug: "cheese", name: "Cheese & Mozzarella", icon: "🍕", description: "Melty, stretchy toppings for pizza, sandwiches, and pasta" },
  { slug: "malai", name: "Malai / Fresh Cream", icon: "🥥", description: "Rich gravies for butter masala, kofta, and shahi gravies" },
  { slug: "eggs", name: "Egg Replacements", icon: "🍳", description: "Binders, leaveners, and breakfast chillas/scrambles" }
];

export const VEGAN_ALTERNATIVES = [
  // --- Category: Dairy Milk ---
  {
    id: "milk-soy",
    category: "milk",
    traditionalFood: "Dairy Milk / Dudh",
    veganAlternative: "Soy Milk (Homemade or Unsweetened Packaged)",
    bestUsedFor: "Daily masala chai, coffee, protein shakes, baking, and North Indian curries.",
    notRecommendedFor: "High-acid sour fruit smoothies (can curdle if not chilled).",
    availability: "Ubiquitous in supermarkets, Blinkit, Zepto, Nature's Basket, or made at home from whole dried soybeans.",
    costComparison: "Homemade: ₹25–₹35 per litre. Packaged: ₹110–₹145 per litre.",
    preparationTime: "Homemade: 35 mins (soak overnight, blend, strain, boil). Packaged: Instant.",
    allergens: ["Soy"],
    nutritionalHighlights: "7–8g complete protein per 250ml cup; rich in isoflavones; zero cholesterol.",
    culinaryTip: "To make masala chai, warm the soy milk gently on low heat and pour the boiling tea decoction into it slowly while stirring to eliminate any beany taste."
  },
  {
    id: "milk-oat",
    category: "milk",
    traditionalFood: "Dairy Milk / Dudh",
    veganAlternative: "Oat Milk (Barista Blend / Rolled Oats)",
    bestUsedFor: "Specialty coffee, lattes, breakfast oats, halwa, and puddings.",
    notRecommendedFor: "Extended aggressive boiling in thin soups (natural starches can thicken excessively).",
    availability: "Widely available on e-commerce platforms (Oatly, Alt Co, Urban Platter) and easy to blend at home.",
    costComparison: "Homemade: ₹30–₹45 per litre. Packaged: ₹180–₹240 per litre.",
    preparationTime: "Homemade: 10 mins (blend cold water + oats 30s, strain through cheesecloth). Packaged: Instant.",
    allergens: ["Gluten (unless certified gluten-free oats)"],
    nutritionalHighlights: "High in beta-glucan soluble dietary fibre; naturally sweet; gentle on digestive systems.",
    culinaryTip: "When making homemade oat milk, always use cold water and do not blend for more than 30–40 seconds to prevent sliminess."
  },
  {
    id: "milk-peanut",
    category: "milk",
    traditionalFood: "Dairy Milk / Dudh",
    veganAlternative: "Peanut-Rice Milk (Moongphali Dudh)",
    bestUsedFor: "Setting thick curd/dahi, kadhi, South Indian sambar bases, and everyday cooking.",
    notRecommendedFor: "Delicate European baking where distinct peanut aroma might conflict.",
    availability: "Extremely cost-effective and made fresh at home from raw peanuts and a handful of cooked rice.",
    costComparison: "Homemade: ₹20–₹30 per litre. Packaged: Select specialty brands (₹90–₹120/L).",
    preparationTime: "Homemade: 25 mins (soak peanuts 4h, blend with cooked rice, boil 5 mins).",
    allergens: ["Peanuts / Groundnuts"],
    nutritionalHighlights: "High plant protein, healthy monounsaturated fats, rich in vitamin E and magnesium.",
    culinaryTip: "Blending a spoonful of cooked rice or soaked poha with soaked peanuts tempers the nutty fragrance and produces an ultra-creamy, neutral milk."
  },
  {
    id: "milk-coconut",
    category: "milk",
    traditionalFood: "Dairy Milk / Dudh",
    veganAlternative: "Fresh or Canned Coconut Milk (Nariyal Ka Dudh)",
    bestUsedFor: "South Indian stew, Avial, Solkadhi, payasam, kheer, and coastal curries.",
    notRecommendedFor: "North Indian masala chai or espresso drinks.",
    availability: "Widely available in fresh grated form across Maharashtra and southern India, or in UHT cartons/cans.",
    costComparison: "Fresh grated coconut: ₹35–₹50 per litre. Canned: ₹80–₹120 per 400ml can.",
    preparationTime: "Fresh: 15 mins (extract first and second press with warm water). Canned: Instant.",
    allergens: ["Tree Nut (Coconut)"],
    nutritionalHighlights: "Rich in Medium Chain Triglycerides (MCTs), lauric acid, and natural electrolytes.",
    culinaryTip: "Add thin coconut milk early in cooking, but stir thick first-press milk at the very end on low heat to prevent splitting."
  },

  // --- Category: Paneer ---
  {
    id: "paneer-tofu",
    category: "paneer",
    traditionalFood: "Dairy Paneer / Cottage Cheese",
    veganAlternative: "Organic Firm Tofu (Soy Bean Curd)",
    bestUsedFor: "Palak paneer (Palak tofu), paneer tikka, bhurji, chili paneer, and matar paneer.",
    notRecommendedFor: "Raw consumption without light seasoning or marination.",
    availability: "Every supermarket, local grocery cold sections, Blinkit, Swiggy Instamart, Zepto.",
    costComparison: "₹60–₹90 per 200g (comparable to or lower than dairy paneer).",
    preparationTime: "Instant. Pressing out excess water takes 10 mins.",
    allergens: ["Soy"],
    nutritionalHighlights: "14–17g protein per 100g; contains all 9 essential amino acids; rich in calcium and iron.",
    culinaryTip: "Marinate pressed tofu in ginger-garlic paste, kasuri methi, turmeric, and lemon juice for 15 minutes before shallow frying for an authentic paneer flavor."
  },
  {
    id: "paneer-peanut",
    category: "paneer",
    traditionalFood: "Dairy Paneer / Cottage Cheese",
    veganAlternative: "Homemade Peanut-Curd Tofu / Paneer",
    bestUsedFor: "Paneer makhani, kadai paneer, and stuffing parathas.",
    notRecommendedFor: "Sweet sandesh or chenna-based Bengali sweets.",
    availability: "Made at home using peanut curd strained through muslin cloth and pressed with a weight.",
    costComparison: "₹25–₹40 per 200g (extremely economical).",
    preparationTime: "15 mins active prep + 2 hours pressing.",
    allergens: ["Peanuts / Groundnuts"],
    nutritionalHighlights: "Rich in plant fats, magnesium, protein, and zero lactose.",
    culinaryTip: "Add a squeeze of lemon and a pinch of rock salt into the curds before pressing for a tangy, authentic cottage cheese bite."
  },

  // --- Category: Dahi / Curd ---
  {
    id: "dahi-peanut",
    category: "dahi",
    traditionalFood: "Dairy Dahi / Curd / Yogurt",
    veganAlternative: "Peanut-Rice Curd (Live Cultured)",
    bestUsedFor: "Thick raita, Gujarati/Rajasthani kadhi, chaas/buttermilk, and biryani marination.",
    notRecommendedFor: "Consuming without a starter culture (must be fermented 6–8 hours).",
    availability: "Easily made at home with warm peanut milk + chili tops or commercial vegan starter (e.g. GoodDot, Urban Platter).",
    costComparison: "Homemade: ₹30 per kg. Packaged (e.g. Epigamia / Alt Co): ₹120–₹160 per 400g.",
    preparationTime: "30 mins prep + 6 to 8 hours fermentation.",
    allergens: ["Peanuts / Groundnuts"],
    nutritionalHighlights: "Millions of live gut-friendly probiotics, healthy lipids, zero cholesterol.",
    culinaryTip: "To start your first vegan curd culture without dairy curd, drop 8–10 green chili crowns (stems) into lukewarm peanut milk and keep warm for 8 hours."
  },
  {
    id: "dahi-soy",
    category: "dahi",
    traditionalFood: "Dairy Dahi / Curd / Yogurt",
    veganAlternative: "Soy Yogurt / Soy Dahi",
    bestUsedFor: "Dahi vada, chaat toppings, hung curd shrikhand, and cooling summer dips.",
    notRecommendedFor: "Overheating without a starch stabilizer (like cornstarch or besan in kadhi).",
    availability: "Available in metros on quick commerce, or cultured at home from plain unsweetened soy milk.",
    costComparison: "Homemade: ₹35 per litre. Packaged: ₹140–₹180 per 500g.",
    preparationTime: "10 mins prep + 6 hours setting time.",
    allergens: ["Soy"],
    nutritionalHighlights: "High bioavailability protein, calcium-fortified, zero saturated dairy fats.",
    culinaryTip: "Whisk with roasted cumin powder, black salt (kala namak), and fresh mint for a refreshing chaas identical to traditional dahi."
  },

  // --- Category: Ghee ---
  {
    id: "ghee-coldpressed",
    category: "ghee",
    traditionalFood: "Desi Cow / Buffalo Ghee",
    veganAlternative: "Cold-Pressed Wood-Pressed Oils (Wood-Pressed Sesame or Groundnut)",
    bestUsedFor: "Traditional dal tadka, hot steamed rice/dal, khichdi, and dosa roasting.",
    notRecommendedFor: "Baking western puff pastry.",
    availability: "Abundant across India in local oil mills (lakdi ghana/kachi ghani) and organic shops.",
    costComparison: "₹250–₹380 per litre (significantly cheaper than A2 cow ghee at ₹1000–₹1800/kg).",
    preparationTime: "Instant / Ready to use.",
    allergens: ["Sesame or Peanuts depending on seed"],
    nutritionalHighlights: "Rich in polyphenols, sesamol antioxidants, oleic and linoleic essential fatty acids.",
    culinaryTip: "A drizzle of raw cold-pressed groundnut oil over piping hot Maharashtrian dal-bhat or pithla-bhakar delivers the traditional comfort and rich mouthfeel."
  },
  {
    id: "ghee-plantbased",
    category: "ghee",
    traditionalFood: "Desi Cow Ghee",
    veganAlternative: "Artisanal Plant-Based Vegan Ghee (e.g. Live Green Co, GoodDot, Emkay)",
    bestUsedFor: "Halwa, ladoos, puran poli, festive sweets, and biryani dum layer.",
    notRecommendedFor: "High-heat deep frying (best reserved for finishing and frying sweets).",
    availability: "Available on Amazon India, Nature's Basket, vegan marketplaces.",
    costComparison: "₹450–₹650 per 500ml.",
    preparationTime: "Instant.",
    allergens: ["May contain nuts (check label)"],
    nutritionalHighlights: "Fortified with Vitamin A & D; zero trans fats; 100% cholesterol-free.",
    culinaryTip: "Infused with natural aromatic botanical extracts that mimic traditional cooked desi ghee aroma when heated."
  },

  // --- Category: Butter ---
  {
    id: "butter-cashew",
    category: "butter",
    traditionalFood: "White Makhan / Dairy Butter",
    veganAlternative: "Homemade Cultured Cashew Butter",
    bestUsedFor: "Spreading on aloo parathas, hot toast, pav bhaji topping, and cookies.",
    notRecommendedFor: "Deep frying.",
    availability: "Made at home in a blender using raw cashews, water, lemon juice, and salt, or bought packaged.",
    costComparison: "Homemade: ₹90 per 200g. Packaged (e.g. WhiteCub): ₹150–₹220 per 200g.",
    preparationTime: "10 mins (soak cashews, blend silky smooth with pinch of turmeric and salt).",
    allergens: ["Tree Nuts (Cashew)"],
    nutritionalHighlights: "High in healthy heart-friendly monounsaturated fats, copper, and magnesium.",
    culinaryTip: "Add a pinch of nutritional yeast and half a teaspoon of apple cider vinegar for the tangy taste of cultured village white makhan."
  },

  // --- Category: Chai & Coffee ---
  {
    id: "chai-soy",
    category: "chai-coffee",
    traditionalFood: "Indian Masala Dudh Chai",
    veganAlternative: "Soy Milk Kadak Masala Chai",
    bestUsedFor: "Everyday morning and evening ginger-cardamom cutting chai.",
    notRecommendedFor: "Chai with sour tamarind or citric additives.",
    availability: "Uses regular unsweetened soy milk available in stores or homemade.",
    costComparison: "₹5–₹8 per cup.",
    preparationTime: "7 mins.",
    allergens: ["Soy"],
    nutritionalHighlights: "Zero lactose, high protein, rich in warm ginger-cardamom bioactives.",
    culinaryTip: "Boil water, loose tea leaves, crushed ginger, cardamom, and jaggery/sugar first for 3 mins. Lower heat, pour in soy milk, and let it simmer for 2 mins without rapid boiling."
  },
  {
    id: "coffee-oat",
    category: "chai-coffee",
    traditionalFood: "Filter Coffee / Milk Latte",
    veganAlternative: "Oat Milk South Indian Filter Coffee",
    bestUsedFor: "Frothy morning filter kaapi, espresso lattes, and iced coffee.",
    notRecommendedFor: "Instant pre-mix sachets containing milk solids.",
    availability: "Barista oat milk widely available across urban stores and online delivery.",
    costComparison: "₹15–₹25 per cup.",
    preparationTime: "5 mins.",
    allergens: ["Gluten (if non-GF oats)"],
    nutritionalHighlights: "Naturally creamy sweetness without needing refined white sugar; gentle on the stomach.",
    culinaryTip: "Warm the oat milk in a pan and froth it with a handheld frother or traditional South Indian dabarah and davarah before pouring over dark decoction."
  },

  // --- Category: Sweets & Mithai ---
  {
    id: "sweets-kheer",
    category: "sweets",
    traditionalFood: "Chawal Ki Kheer / Payasam",
    veganAlternative: "Almond-Coconut Milk Rice Kheer",
    bestUsedFor: "Diwali, Eid, weddings, and festival feasts.",
    notRecommendedFor: "Cooking with sour fruits.",
    availability: "Ingredients readily available in every Indian pantry.",
    costComparison: "₹60–₹85 for a 4-person festive batch.",
    preparationTime: "30 mins.",
    allergens: ["Tree Nuts (Almond, Coconut)"],
    nutritionalHighlights: "Rich in antioxidants, cardamom, saffron, and natural healthy nut fats.",
    culinaryTip: "Cook rice in water with saffron and green cardamom until soft, then stir in soaked ground almond paste and thick coconut milk for the last 5 minutes."
  },
  {
    id: "sweets-gulabjamun",
    category: "sweets",
    traditionalFood: "Mawa / Khoya Gulab Jamun",
    veganAlternative: "Sweet Potato / Bread & Semolina Gulab Jamun",
    bestUsedFor: "Celebratory feasts and dessert cravings.",
    notRecommendedFor: "Those avoiding all gluten (if using semolina/bread).",
    availability: "Standard home kitchen ingredients (boiled sweet potatoes, sooji, cardamom sugar syrup).",
    costComparison: "₹40–₹60 per batch of 15 dumplings.",
    preparationTime: "45 mins.",
    allergens: ["Gluten (if sooji used)"],
    nutritionalHighlights: "High in complex carbs, beta-carotene (from sweet potato), and dietary fibre.",
    culinaryTip: "Boil sweet potatoes until tender, knead with a tablespoon of fine sooji into soft crack-free balls, deep-fry in groundnut oil, and steep in rose-infused sugar syrup."
  },

  // --- Category: Cheese ---
  {
    id: "cheese-cashewmozzarella",
    category: "cheese",
    traditionalFood: "Processed Dairy Cheese / Mozzarella",
    veganAlternative: "Tapioca-Cashew Stretch Mozzarella",
    bestUsedFor: "Tawa pizza, cheese toast, grilled sandwiches, and pasta bakes.",
    notRecommendedFor: "Cold cheese platters where hard aged cheddar consistency is expected.",
    availability: "Easily prepared in 10 mins using soaked cashews, tapioca starch (sabudana flour), and garlic powder.",
    costComparison: "Homemade: ₹60 per 250g. Packaged (Violife, Urban Platter): ₹280–₹380 per 200g.",
    preparationTime: "10 mins active cooking on stovetop.",
    allergens: ["Tree Nuts (Cashew)"],
    nutritionalHighlights: "Zero cholesterol, zero casein, healthy magnesium and potassium.",
    culinaryTip: "Whisk blended cashew paste and tapioca starch in a saucepan over medium heat; within 3 minutes it transforms into a stretchy, gooey mozzarella that browns under a broiler."
  },

  // --- Category: Cream / Malai ---
  {
    id: "malai-cashewcream",
    category: "malai",
    traditionalFood: "Dairy Malai / Fresh Cream",
    veganAlternative: "Silky Soaked Cashew Paste (Kaju Malai)",
    bestUsedFor: "Paneer butter masala (Tofu makhani), methi matar malai, dal makhani, and soup garnishes.",
    notRecommendedFor: "Whipping into high-peak birthday cake icing.",
    availability: "Staple ingredient in every Indian pantry.",
    costComparison: "₹80 per cup of thick cream.",
    preparationTime: "5 mins (soak cashews in hot water for 15 mins, blend with water until completely velvety).",
    allergens: ["Tree Nuts (Cashew)"],
    nutritionalHighlights: "Silky texture without heavy dairy saturated fats; rich in iron and healthy fats.",
    culinaryTip: "Stir in cashew cream during the last 2 minutes of simmering your curry to achieve restaurant-style sheen and velvety richness."
  },

  // --- Category: Egg Replacements ---
  {
    id: "egg-besanchilla",
    category: "eggs",
    traditionalFood: "Breakfast Egg Omelette / Bhurji",
    veganAlternative: "Besan / Moong Dal Vegetarian Omelette (Chilla)",
    bestUsedFor: "Protein-packed breakfast, street food rolls, and evening snacks.",
    notRecommendedFor: "Baking souffles.",
    availability: "Present in 100% of Indian households (Gram flour / Besan or yellow Moong dal).",
    costComparison: "₹8–₹12 per serving.",
    preparationTime: "10 mins.",
    allergens: ["Legumes"],
    nutritionalHighlights: "12g plant protein, zero cholesterol, low glycemic index, high soluble fibre.",
    culinaryTip: "Add a pinch of black salt (kala namak) — its natural sulphur minerals replicate the exact taste and aroma of traditional egg omelettes."
  },
  {
    id: "egg-flaxseed",
    category: "eggs",
    traditionalFood: "Eggs in Baking (Cakes, Muffins, Brownies)",
    veganAlternative: "Flax Egg (Ground Alsi / Flaxseed Meal + Water)",
    bestUsedFor: "Baking banana bread, moist brownies, pancakes, and cookies.",
    notRecommendedFor: "Making scrambled eggs or sunny-side up.",
    availability: "Available in every kirana and supermarket across India (Alsi seeds).",
    costComparison: "₹2 per 'egg' equivalent.",
    preparationTime: "5 mins (mix 1 tbsp ground flax with 2.5 tbsp warm water; let sit until gelled).",
    allergens: ["Seeds"],
    nutritionalHighlights: "Super-rich in plant-based Omega-3 fatty acids (ALA) and lignans.",
    culinaryTip: "1 tablespoon of ground flaxseed + 2.5 tablespoons of warm water replaces 1 egg in baking recipes and provides superior moisture retention."
  }
];

export function getAllAlternatives() {
  return VEGAN_ALTERNATIVES;
}

export function getAlternativesByCategory(categorySlug) {
  if (!categorySlug || categorySlug === "all") {
    return VEGAN_ALTERNATIVES;
  }
  return VEGAN_ALTERNATIVES.filter(item => item.category === categorySlug);
}

export function searchAlternatives(query, categorySlug = "all", allergenToExclude = "") {
  let list = getAlternativesByCategory(categorySlug);

  if (allergenToExclude) {
    list = list.filter(item => {
      if (!item.allergens || item.allergens.length === 0) return true;
      return !item.allergens.some(a => a.toLowerCase().includes(allergenToExclude.toLowerCase()));
    });
  }

  if (!query || !query.trim()) {
    return list;
  }

  const q = query.trim().toLowerCase();
  return list.filter(item => {
    return (
      item.traditionalFood.toLowerCase().includes(q) ||
      item.veganAlternative.toLowerCase().includes(q) ||
      item.bestUsedFor.toLowerCase().includes(q) ||
      item.culinaryTip.toLowerCase().includes(q) ||
      item.nutritionalHighlights.toLowerCase().includes(q) ||
      item.availability.toLowerCase().includes(q)
    );
  });
}
