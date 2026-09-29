/* ==========================================================================
   VeganSaathi — mock-data.js
   ============================================================================
   *** DEVELOPMENT MOCK DATA — NOT REAL FIELDWORK DATA ***
   Every place, review, user, and report below is invented purely to let the
   Phase 2 static frontend render and be tested. None of this represents an
   actual verified Shegaon business, a real review, or a real report.
   Before final CEP deployment, this file must be replaced entirely by data
   collected through real fieldwork (see docs/CEP_REQUIREMENTS.md and
   docs/FIELDWORK_GUIDE.md) and loaded from Firestore instead.
   ========================================================================== */

const MOCK_PLACES = [
  {
    id: "mock-001",
    name: "[MOCK] Green Leaf Mess",
    placeType: "mess",
    dietTags: ["vegan", "vegetarian", "jain"],
    priceRange: "budget",
    area: "Near SSGMCE Hostel Block A (mock area)",
    address: "Mock Address, Shegaon",
    description: "Placeholder description of a hostel mess with vegan and Jain options. This entry exists only for frontend development.",
    latitude: 20.7935,
    longitude: 76.6977,
    verificationStatus: "verified",
    lastVerifiedAt: "2026-09-10",
    imageLabel: "Mess"
  },
  {
    id: "mock-002",
    name: "[MOCK] Shegaon Sattvik Dhaba",
    placeType: "dhaba",
    dietTags: ["vegetarian", "jain"],
    priceRange: "moderate",
    area: "Near Gajanan Maharaj Temple (mock area)",
    address: "Mock Address, Shegaon",
    description: "Placeholder dhaba entry — Jain-friendly thali, sample data only.",
    latitude: 20.7960,
    longitude: 76.6930,
    verificationStatus: "unverified",
    lastVerifiedAt: null,
    imageLabel: "Dhaba"
  },
  {
    id: "mock-003",
    name: "[MOCK] Campus Corner Canteen",
    placeType: "canteen",
    dietTags: ["vegetarian", "eggetarian"],
    priceRange: "budget",
    area: "SSGMCE Campus (mock area)",
    address: "Mock Address, SSGMCE",
    description: "Placeholder canteen entry — eggetarian options available, sample data only.",
    latitude: 20.7900,
    longitude: 76.7000,
    verificationStatus: "verified",
    lastVerifiedAt: "2026-08-28",
    imageLabel: "Canteen"
  },
  {
    id: "mock-004",
    name: "[MOCK] Plant & Pulse Cafe",
    placeType: "cafe",
    dietTags: ["vegan"],
    priceRange: "moderate",
    area: "Shegaon Town (mock area)",
    address: "Mock Address, Shegaon",
    description: "Placeholder cafe entry — fully vegan menu, sample data only.",
    latitude: 20.7975,
    longitude: 76.6955,
    verificationStatus: "unverified",
    lastVerifiedAt: null,
    imageLabel: "Cafe"
  },
  {
    id: "mock-005",
    name: "[MOCK] Varadi Thali House",
    placeType: "restaurant",
    dietTags: ["vegetarian"],
    priceRange: "moderate",
    area: "Shegaon Town (mock area)",
    address: "Mock Address, Shegaon",
    description: "Placeholder restaurant entry showcasing Vidarbha-style vegetarian thali, sample data only.",
    latitude: 20.7945,
    longitude: 76.6990,
    verificationStatus: "verified",
    lastVerifiedAt: "2026-09-01",
    imageLabel: "Restaurant"
  },
  {
    id: "mock-006",
    name: "[MOCK] Roadside Poha Stall",
    placeType: "other",
    dietTags: ["vegan", "vegetarian"],
    priceRange: "budget",
    area: "Near Bus Stand (mock area)",
    address: "Mock Address, Shegaon",
    description: "Placeholder street-food stall entry, sample data only.",
    latitude: 20.7920,
    longitude: 76.6945,
    verificationStatus: "unverified",
    lastVerifiedAt: null,
    imageLabel: "Stall"
  }
];

const MOCK_REVIEWS = [
  { id: "rev-001", placeId: "mock-001", userName: "[MOCK] A. Student", rating: 5, comment: "Placeholder review text — sample data only, not a real review.", createdAt: "2026-09-12" },
  { id: "rev-002", placeId: "mock-001", userName: "[MOCK] R. Resident", rating: 4, comment: "Placeholder review text — sample data only, not a real review.", createdAt: "2026-09-05" },
  { id: "rev-003", placeId: "mock-003", userName: "[MOCK] S. Scholar", rating: 4, comment: "Placeholder review text — sample data only, not a real review.", createdAt: "2026-08-30" },
  { id: "rev-004", placeId: "mock-005", userName: "[MOCK] P. Traveller", rating: 5, comment: "Placeholder review text — sample data only, not a real review.", createdAt: "2026-09-02" }
];

const MOCK_USER = {
  // A single sample "logged in" profile used only to render the Profile page UI in Phase 2.
  name: "[MOCK] Demo User",
  email: "demo.user@example.com",
  dietPreference: "vegan",
  createdAt: "2026-09-01"
};

const MOCK_MY_SUBMISSIONS = [
  { id: "mock-002", name: "[MOCK] Shegaon Sattvik Dhaba", status: "pending" },
  { id: "mock-004", name: "[MOCK] Plant & Pulse Cafe", status: "pending" }
];

const MOCK_MY_REVIEWS = [
  { placeId: "mock-001", placeName: "[MOCK] Green Leaf Mess", rating: 5, comment: "Placeholder review text — sample data only." }
];

const MOCK_SAVED_PLACES = ["mock-001", "mock-005"];

const MOCK_ADMIN_STATS = {
  pendingPlaces: 2,
  publishedPlaces: 4,
  openReports: 1,
  totalUsers: 12
};

const MOCK_ADMIN_PENDING = [
  { id: "mock-002", name: "[MOCK] Shegaon Sattvik Dhaba", submittedBy: "[MOCK] R. Resident", submittedAt: "2026-09-14" },
  { id: "mock-004", name: "[MOCK] Plant & Pulse Cafe", submittedBy: "[MOCK] S. Scholar", submittedAt: "2026-09-15" }
];

const MOCK_ADMIN_REPORTS = [
  { id: "rep-001", placeName: "[MOCK] Roadside Poha Stall", reason: "outdated", status: "pending", reportedAt: "2026-09-16" }
];

const MOCK_ADMIN_REVIEWS = MOCK_REVIEWS;
