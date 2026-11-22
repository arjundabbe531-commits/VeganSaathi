/* ==========================================================================
   VeganSaathi — ingredient-checker-data.js
   ============================================================================
   Curated, authoritative Indian dietary ingredient compass.
   Helps conscious eaters, vegans, vegetarians, and Jains verify traditional
   Indian foods, restaurant preparations, and food additives.
   ========================================================================== */

export const INGREDIENT_CATEGORIES = [
  { id: "all", label: "All Items", icon: "🔍" },
  { id: "dairy-fats", label: "Dairy & Animal Fats", icon: "🧈" },
  { id: "sweets-bakery", label: "Traditional Sweets & Bakery", icon: "🍬" },
  { id: "additives", label: "Additives & E-Numbers", icon: "🔬" },
  { id: "restaurant-prep", label: "Restaurant & Dhaba Prep", icon: "🍲" },
  { id: "plant-safe", label: "100% Plant-Based Safe", icon: "🌱" }
];

export const INGREDIENT_ITEMS = [
  {
    id: "desi-ghee",
    name: "Desi Ghee (साजूक तूप)",
    category: "dairy-fats",
    status: "non-vegan",
    marathiName: "साजूक तूप / शुद्ध तूप",
    description: "Clarified butter prepared by simmering cow or buffalo milk curd/butter. Extensively used in dal tadka, sweets, rotis, and prasad.",
    hiddenIn: "Dal tadka, biryani, halwa, ladoo, sheera, khichdi, puran poli, parathas.",
    chefAdviceEn: "Ask: 'Please temper the dal/curry in groundnut or vegetable oil only, with NO ghee or butter on top.'",
    chefAdviceMr: "कृपया डाळीला/भाजीला फक्त तेलाची फोडणी द्या, वरून साजूक तूप किंवा लोणी घालू नका.",
    alternative: "Cold-pressed groundnut oil, sesame (til) oil, coconut oil, or plant-based vanaspati."
  },
  {
    id: "paneer",
    name: "Paneer / Cottage Cheese (पनीर)",
    category: "dairy-fats",
    status: "non-vegan",
    marathiName: "पनीर",
    description: "Acid-set cheese made from cow or buffalo milk using lemon juice or curd. High in dairy casein and fat.",
    hiddenIn: "Paneer butter masala, palak paneer, veg biryani, samosas, koftas.",
    chefAdviceEn: "Ask: 'Can you replace paneer with fresh tofu or mushroom/potatoes in this curry?'",
    chefAdviceMr: "पनीर ऐवजी सोया टोफू (Tofu) किंवा मशरूम वापरता येईल का?",
    alternative: "Organic firm tofu, tempeh, or soya chaap."
  },
  {
    id: "silver-vark",
    name: "Vark / Silver Foil (चांदीचा वरख)",
    category: "sweets-bakery",
    status: "caution",
    marathiName: "चांदीचा वरख",
    description: "Ultra-thin silver foil used on Indian sweets. Traditionally beaten between animal ox-gut sheets. Modern certified vegetarian silver foil exists, but street mithai often still uses non-verified sources.",
    hiddenIn: "Kaju katli, kaju roll, motichoor ladoo, barfi, paan.",
    chefAdviceEn: "Ask: 'Is this sweet made without silver foil (plain), or is the vark certified machine-made/vegetarian?'",
    chefAdviceMr: "वरख नसलेली साधी काजू कतली मिळेल का?",
    alternative: "Sweets garnished naturally with crushed pistachios, almonds, or saffron strands without foil."
  },
  {
    id: "khoya-mawa",
    name: "Mawa / Khoya (खवा / मावा)",
    category: "sweets-bakery",
    status: "non-vegan",
    marathiName: "खवा / मावा",
    description: "Dried, condensed whole milk solids created by boiling down milk for hours in large iron karahis.",
    hiddenIn: "Gulab jamun, pedha, barfi, gujiya/karanji, shahi korma gravies.",
    chefAdviceEn: "Ask: 'Does this gravy or dessert contain mawa/khoya or dairy milk solids?'",
    chefAdviceMr: "ह्या ग्रेव्हीत किंवा मिठाईत खवा किंवा दुधाचे पदार्थ वापरले आहेत का?",
    alternative: "Cashew paste, almond flour, roasted chickpea flour (besan), or coconut condensed milk."
  },
  {
    id: "curd-dahi",
    name: "Dahi / Curd / Buttermilk (दही / ताक)",
    category: "dairy-fats",
    status: "non-vegan",
    marathiName: "दही / ताक / चक्का",
    description: "Fermented dairy milk product. Used both as a standalone food and as a secret tenderizer or souring agent in gravies and marinades.",
    hiddenIn: "Kadhi, raita, biryani marinades, shrikhand, chaat, naan dough.",
    chefAdviceEn: "Ask: 'Is curd or yogurt used in this gravy marinade or dough?'",
    chefAdviceMr: "ह्या भाजीत किंवा ग्रेव्हीत दही वापरले आहे का? कृपया दही न घालता बनवा.",
    alternative: "Peanut-curd (शेंगदाणा दही), cashew yogurt, or lemon/amchur for tartness."
  },
  {
    id: "white-sugar",
    name: "Refined White Sugar (पांढरी साखर)",
    category: "additives",
    status: "caution",
    marathiName: "रिफाईंड साखर",
    description: "Some imported refined sugars are decolourised using bone char (cattle bones). Most Indian sulfur-method refined sugars are sulfur-bleached without bone char, but organic raw jaggery is always safest and healthier.",
    hiddenIn: "Commercial candies, soft drinks, refined pastries, imported confectioneries.",
    chefAdviceEn: "Choose sweets prepared with organic jaggery (गुळ), brown sugar, or sulfur-free khandsari.",
    chefAdviceMr: "साखरेऐवजी सेंद्रिय गुळ किंवा खांडसरी वापरलेली मिठाई उत्तम.",
    alternative: "Organic Jaggery (सेंद्रिय गूळ), dates syrup, or pure coconut sugar."
  },
  {
    id: "naan-bread",
    name: "Tandoori Naan & Kulcha (नान / कुलचा)",
    category: "restaurant-prep",
    status: "caution",
    marathiName: "तंदुरी नान / कुलचा",
    description: "Many restaurants knead naan dough with milk, yogurt, or egg for elasticity and fluffiness, and brush the hot naan with melted butter/ghee upon serving.",
    hiddenIn: "Butter naan, garlic naan, cheese naan, Amritsari kulcha.",
    chefAdviceEn: "Ask: 'Please give me Tandoori Roti or Plain Roti (wheat flour + water only), roasted dry with NO butter or ghee on top.'",
    chefAdviceMr: "कृपया साधी तंदुरी किंवा तवा रोटी द्या, बटर किंवा तूप लावू नका (Dry Roti).",
    alternative: "Tawa Roti, Missi Roti, Jowar Bhakri (ज्वारी भाकरी), or Bajra Bhakri (बाजरी भाकरी)."
  },
  {
    id: "malai-cream",
    name: "Malai / Fresh Cream (मलाई / फ्रेश क्रीम)",
    category: "dairy-fats",
    status: "non-vegan",
    marathiName: "मलाई / दुधाची साय",
    description: "High-fat dairy cream skimmed from boiled milk. Ubiquitous in North Indian & restaurant-style tomato/onion gravies.",
    hiddenIn: "Dal makhani, shahi veg korma, veg handi, tomato soup, kaju curry.",
    chefAdviceEn: "Ask: 'Please prepare the gravy with cashew paste only and do not swirl fresh cream or butter on top.'",
    chefAdviceMr: "भाजीत किंवा सूपमध्ये मलाई किंवा क्रीम घालू नका, फक्त काजू पेस्ट वापरा.",
    alternative: "Rich cashew paste (काजू वाटण), coconut cream, or sunflower seed cream."
  },
  {
    id: "honey",
    name: "Honey (मध)",
    category: "sweets-bakery",
    status: "non-vegan",
    marathiName: "मध",
    description: "Produced by bees from flower nectar for their colony's survival and food storage.",
    hiddenIn: "Honey chilli potatoes, lemon-honey tea, breakfast cereals, ayurvedic tonics.",
    chefAdviceEn: "Ask: 'Substitute honey with pure jaggery syrup, maple syrup, or dates paste.'",
    chefAdviceMr: "मधाऐवजी गुळाचा पाक किंवा खजुराची पेस्ट वापरा.",
    alternative: "Dates syrup (खजूर सिरप), jaggery syrup, or raw sugarcane juice reduction."
  },
  {
    id: "shellac-e904",
    name: "Shellac / Confectioner's Glaze (E904)",
    category: "additives",
    status: "non-vegan",
    marathiName: "शेलॅक (किड्यांचा डिंक)",
    description: "A resin secreted by the female lac bug (*Kerria lacca*) on trees in India and Thailand, harvested to coat fruits, pills, and shiny candies.",
    hiddenIn: "Shiny coated chocolates, jelly beans, waxed apples, coated medicinal tablets.",
    chefAdviceEn: "Look out for ingredient labels stating: Shellac, Confectioner's Glaze, Resinous Glaze, or INS/E 904.",
    chefAdviceMr: "मिठाई किंवा गोळ्यांवर E904 किंवा Shellac लिहिलेले असल्यास ते टाळा.",
    alternative: "Plant carnauba wax (E903) or unglazed dried fruits."
  },
  {
    id: "gelatin-e441",
    name: "Gelatin (E441 / जिलेटिन)",
    category: "additives",
    status: "non-vegan",
    marathiName: "जिलेटिन",
    description: "Animal protein extracted by boiling skin, tendons, ligaments, and bones of animals (pigs, cows).",
    hiddenIn: "Jelly cups, marshmallows, gummy candies, capsule coatings, cheesecakes.",
    chefAdviceEn: "Ensure gelling agents use Agar-Agar (China Grass) or pectin from fruit peels.",
    chefAdviceMr: "जिलेटिनऐवजी अगर-अगर (चायना ग्रास) किंवा फ्रूट पेक्टिन वापरा.",
    alternative: "Agar-Agar (चायना ग्रास), Pectin (पेक्टिन), or Carrageenan."
  },
  {
    id: "casein-whey",
    name: "Casein & Whey Solids (केसीन व व्हे पावडर)",
    category: "additives",
    status: "non-vegan",
    marathiName: "दुधाचे प्रोटीन (केसीन / व्हे)",
    description: "Major proteins derived from cow/buffalo milk during cheese and paneer curdling.",
    hiddenIn: "Protein powders, packaged biscuits, bakery breads, non-dairy creamers, processed chips.",
    chefAdviceEn: "Check biscuit and bread labels for 'milk solids', 'whey protein concentrate', or 'caseinate'.",
    chefAdviceMr: "पाकिटावरील घटकांमध्ये 'Milk Solids' किंवा 'Whey' तपासा.",
    alternative: "Pea protein, brown rice protein, or hemp seed protein."
  },
  {
    id: "dal-tadka-clarification",
    name: "Dhaba Dal Tadka / Dal Fry (दाल तडका)",
    category: "restaurant-prep",
    status: "caution",
    marathiName: "दाल तडका / दाल फ्राय",
    description: "Cooked yellow lentils (toor or chana dal). While the lentils are plant-based, dhabas almost universally fry the garlic-cumin tempering (tadka) in ghee or add a generous cube of butter on top before serving.",
    hiddenIn: "Roadside dhabas, family restaurants, hotel thalis.",
    chefAdviceEn: "Ask explicitly: 'Dal Tadka me tel ka tadka lagana, ghee ya amul butter bilkul mat dalna.'",
    chefAdviceMr: "दाल तडक्याला फक्त तेलाची फोडणी द्या, वरून तूप किंवा बटर मुळीच घालू नका.",
    alternative: "Tel-chi Phodani Dal (Garlic-jeera tempering in pure mustard or groundnut oil)."
  },
  {
    id: "tofu",
    name: "Tofu / Soya Paneer (टोफू)",
    category: "plant-safe",
    status: "vegan-safe",
    marathiName: "सोया पनीर / टोफू",
    description: "Curd made from ground soybean milk, coagulated with nigari or calcium salts. 100% plant-based, zero cholesterol, rich in complete amino acids.",
    hiddenIn: "Asian cuisines, modern Indian curries, vegan protein bowls.",
    chefAdviceEn: "Can be seamlessly substituted 1:1 for paneer in Palak Tofu, Tofu Bhurji, and Tofu Makhani.",
    chefAdviceMr: "पनीरप्रमाणेच टोफू भुर्जी किंवा पालक टोफू बनवून चवदार आहाराचा आनंद घ्या.",
    alternative: "Natural, healthy protein powerhouse."
  },
  {
    id: "bhakri",
    name: "Jowar / Bajra Bhakri (भाकरी)",
    category: "plant-safe",
    status: "vegan-safe",
    marathiName: "ज्वारी / बाजरीची भाकरी",
    description: "Traditional rustic Maharashtra flatbread hand-patted and baked on a clay or iron tawa. Contains only whole grain flour, water, and salt. Pure, unadulterated, fiber-rich, and naturally vegan & gluten-free.",
    hiddenIn: "Maharashtra thalis, rural dhabas, pilgrimage bhojanalays.",
    chefAdviceEn: "Specify: 'Bhakri bina ghee lagaye plain dena' (served dry without ghee brushing).",
    chefAdviceMr: "भाकरीला वरून तूप न लावता साधी (कोरी) द्या.",
    alternative: "The gold standard of wholesome conscious Maharashtra dining."
  },
  {
    id: "peanut-curd",
    name: "Peanut Curd (शेंगदाणा दही)",
    category: "plant-safe",
    status: "vegan-safe",
    marathiName: "शेंगदाण्याचे दही",
    description: "Thick, silky curd cultured from raw blanched peanut milk using lemon or chilli tops. Sets just like dairy curd and makes stellar kadhi, chaat, and raita.",
    hiddenIn: "Home plant-based kitchens, conscious cafes.",
    chefAdviceEn: "Cultured at room temperature in Maharashtra homes for an authentic probiotic taste.",
    chefAdviceMr: "शेंगदाणा दुधात हिरव्या मिरचीचे देठ घालून ४-६ तासांत छान घट्ट दही जमते.",
    alternative: "Zero cruelty, cost-effective Indian alternative to dairy curd."
  }
];
