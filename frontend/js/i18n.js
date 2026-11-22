/* ==========================================================================
   VeganSaathi — i18n.js
   ============================================================================
   Lightweight, accessible bilingual localization for Maharashtra community.
   Supports English and Marathi (मराठी) without external dependencies.
   ========================================================================== */

const DICTIONARY = {
  en: {
    "nav.home": "Home",
    "nav.explore": "Explore",
    "nav.alternatives": "Alternatives",
    "nav.compass": "Compass",
    "nav.awareness": "Awareness",
    "nav.contribute": "Contribute",
    "nav.login": "Login",
    "nav.register": "Register",
    "nav.profile": "Profile",
    "nav.logout": "Logout",
    "nav.diningCard": "Dining Card",
    "brand.tagline": "Community Discovery Portal",
    "filter.allTypes": "All place types",
    "filter.anyPrice": "Any price",
    "filter.vegan": "🌱 Vegan",
    "filter.vegetarian": "🥬 Vegetarian",
    "filter.jain": "🪷 Jain friendly",
    "filter.verified": "🛡️ Verified only",
    "filter.reset": "✕ Reset filters",
    "action.useLocation": "📍 Use my location",
    "action.refresh": "🔄 Refresh",
    "action.list": "List",
    "action.map": "Map",
    "action.share": "🔗 Share Place",
    "action.save": "Save Place",
    "action.saved": "Saved",
    "action.directions": "📍 Open in Google Maps",
    "dining.title": "Conscious Dining Card",
    "dining.subtitle": "Show this card to the chef or waiter when ordering anywhere in Maharashtra",
    "dining.mrText": "मी पूर्ण शाकाहारी (व्हेगन) आहे. माझ्या जेवणात दूध, दही, साजूक तूप, लोणी, मलाई, पनीर, चीज, किंवा मध मुळीच वापरू नका. कृपया माझे जेवण फक्त वनस्पती तेलात बनवा आणि वरून तूप किंवा बटर घालू नका. धन्यवाद!",
    "dining.enText": "I follow a 100% plant-based / vegan diet. Please do not use milk, curd, ghee, butter, cream, paneer, cheese, or honey in my food. Please cook only in vegetable oil (groundnut, sunflower, sesame) and do not brush with butter. Thank you!"
  },
  mr: {
    "nav.home": "मुख्यपृष्ठ",
    "nav.explore": "शोधा",
    "nav.alternatives": "पर्याय",
    "nav.compass": "आहार मार्गदर्शक",
    "nav.awareness": "जागरूकता",
    "nav.contribute": "नोंदवा",
    "nav.login": "लॉगिन",
    "nav.register": "नोंदणी",
    "nav.profile": "माझे प्रोफाइल",
    "nav.logout": "बाहेर पडा",
    "nav.diningCard": "डायनिंग कार्ड",
    "brand.tagline": "महाराष्ट्र समुदाय मंच",
    "filter.allTypes": "सर्व प्रकार",
    "filter.anyPrice": "कोणतीही किंमत",
    "filter.vegan": "🌱 व्हेगन",
    "filter.vegetarian": "🥬 शाकाहारी",
    "filter.jain": "🪷 जैन अनुकूल",
    "filter.verified": "🛡️ केवळ पडताळलेले",
    "filter.reset": "✕ सर्व फिल्टर काढा",
    "action.useLocation": "📍 माझे स्थान वापरा",
    "action.refresh": "🔄 ताजे करा",
    "action.list": "यादी",
    "action.map": "नकाशा",
    "action.share": "🔗 माहिती शेअर करा",
    "action.save": "जतन करा",
    "action.saved": "जतन केले",
    "action.directions": "📍 गुगल मॅपवर दिशा",
    "dining.title": "शाकाहारी व व्हेगन डायनिंग कार्ड",
    "dining.subtitle": "महाराष्ट्रात हॉटेल, धाबा किंवा प्रसाहालयात ऑर्डर देताना हे कार्ड वेटर किंवा शेफला दाखवा",
    "dining.mrText": "मी पूर्ण शाकाहारी (व्हेगन) आहे. माझ्या जेवणात दूध, दही, साजूक तूप, लोणी, मलाई, पनीर, चीज, किंवा मध मुळीच वापरू नका. कृपया माझे जेवण फक्त वनस्पती तेलात बनवा आणि वरून तूप किंवा बटर घालू नका. धन्यवाद!",
    "dining.enText": "I follow a 100% plant-based / vegan diet. Please do not use milk, curd, ghee, butter, cream, paneer, cheese, or honey in my food. Please cook only in vegetable oil (groundnut, sunflower, sesame) and do not brush with butter. Thank you!"
  }
};

const STORAGE_KEY = "vs_language_preference";

export function getLanguage() {
  if (typeof localStorage === "undefined") return "en";
  return localStorage.getItem(STORAGE_KEY) || "en";
}

export function setLanguage(lang) {
  if (lang !== "en" && lang !== "mr") lang = "en";
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch (e) {
      // Ignore
    }
  }
  applyTranslations(lang);
  document.dispatchEvent(new CustomEvent("vs:languageChanged", { detail: { lang: lang } }));
}

export function t(key, defaultVal) {
  const lang = getLanguage();
  const dict = DICTIONARY[lang] || DICTIONARY.en;
  return dict[key] || DICTIONARY.en[key] || defaultVal || key;
}

export function applyTranslations(lang) {
  lang = lang || getLanguage();
  const dict = DICTIONARY[lang] || DICTIONARY.en;

  document.querySelectorAll("[data-i18n]").forEach(function (el) {
    const key = el.getAttribute("data-i18n");
    if (dict[key]) {
      if (el.tagName === "INPUT" && el.hasAttribute("placeholder")) {
        el.setAttribute("placeholder", dict[key]);
      } else {
        el.textContent = dict[key];
      }
    }
  });

  const toggleBtn = document.getElementById("langToggleBtn");
  if (toggleBtn) {
    toggleBtn.textContent = lang === "mr" ? "🌐 मराठी (MR)" : "🌐 English (EN)";
    toggleBtn.title = lang === "mr" ? "Switch to English" : "मराठीमध्ये पहा";
  }
}

export function initI18n() {
  applyTranslations();
  const toggleBtn = document.getElementById("langToggleBtn");
  if (toggleBtn) {
    toggleBtn.addEventListener("click", function () {
      const current = getLanguage();
      const next = current === "en" ? "mr" : "en";
      setLanguage(next);
    });
  }
}
