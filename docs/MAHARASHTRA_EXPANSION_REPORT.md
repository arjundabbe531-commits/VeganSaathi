# VeganSaathi — Maharashtra Statewide Research Expansion Report

**Project:** VeganSaathi (SSGMCE Community Engagement Project)  
**Document:** Maharashtra Regional Expansion Report  
**Dataset:** `research/maharashtra_research_leads.csv`  
**Status:** Research Leads Curation & Verification Pipeline  
**Date:** November 2026

---

## 1. Executive Summary

VeganSaathi originated as a campus-focused Community Engagement Project (CEP) at Shri Sant Gajanan Maharaj College of Engineering (SSGMCE) in Shegaon, Buldhana District, Maharashtra. While the initial prototype mapped student messes, campus cafes, and local eateries in Shegaon, student mobility and community feedback underscored the critical need for reliable plant-based foodway intelligence across major educational and commercial centers in Maharashtra.

This expansion curates and classifies 22 high-fidelity research leads spanning **8 major urban and regional culinary zones** in Maharashtra:
1. **Mumbai** (Khar West, Bandra West, Fort, Vile Parle)
2. **Pune** (Koregaon Park, Viman Nagar, Deccan / FC Road)
3. **Nagpur** (Pratap Nagar, Dharampeth, Sadar)
4. **Nashik** (College Road, Gangapur Road)
5. **Thane** (Ghodbunder Road, Hiranandani Estate)
6. **Navi Mumbai** (Vashi)
7. **Kolhapur** (Shahupuri, Rajarampuri)
8. **Chhatrapati Sambhajinagar / Aurangabad** (CIDCO Connaught Place, Nirala Bazar)
9. **Shegaon** (Baseline campus and temple foodways)

---

## 2. Methodology & Evidence Tiers

To safeguard platform integrity, VeganSaathi enforces a strict separation between **unverified research leads** and **publicly verified listings**:

- **Strict Boundary**: Research leads in `research/maharashtra_research_leads.csv` are strictly marked with `verification_status="research_lead"`. They are **never** automatically promoted to `verified` or directly injected into the public production database without completing either physical field audit or primary verified source clearance.
- **Evidence Sources**:
  - **SHARAN India & Plant-Based Certified**: Venues adhering to whole-food plant-based nutritional guidelines (e.g., Aharveda, Sante Spa Cuisine).
  - **Pioneering 100% Vegan Kitchens**: Venues with zero animal products on premises (e.g., Rare Earth The Vegan Cafe, The Real Green Cafe Pune, Earthlings Cafe).
  - **In-Person Fieldwork**: Physical checks conducted by student researchers checking cooking oils, separate tawas, and dairy cross-contact (e.g., Green Leaf Bistro Pune, Veeraswami Nagpur, SSGMCE Campus Cafeteria).
  - **Official Business Records & Menus**: Direct menu audits verifying almond/oat/soy milk options, tofu substitutions, and dairy-free regional specialties.

---

## 3. Geographic Distribution & Highlights

| City | Lead Count | Focus Culinary Districts | Notable Lead Establishments |
| :--- | :--- | :--- | :--- |
| **Mumbai** | 5 | Bandra West, Khar West, Fort, Vile Parle | Rare Earth, Earth Cafe, Yogisattva, Burma Burma, Aharveda |
| **Pune** | 4 | Koregaon Park, Viman Nagar, FC Road Deccan | The Real Green Cafe, Sante Spa Cuisine, Earthlings Cafe, Green Leaf Bistro |
| **Nagpur** | 3 | Dharampeth, Sadar, Pratap Nagar | The Breakfast Story, Fuel Station Cafe, Veeraswami Pure Veg |
| **Nashik** | 2 | College Road, Gangapur Road | The Vibe Cafe, Riverdine Pure Veg |
| **Thane** | 1 | Ghodbunder Road / Hiranandani Estate | Sante Spa Cuisine Thane |
| **Navi Mumbai**| 1 | Vashi Sector 17 | Little Italy Vashi |
| **Kolhapur** | 2 | Shahupuri, Rajarampuri | Dehaati Pure Veg, Hotel Opal Kolhapur |
| **Chh. Sambhajinagar** | 2 | Connaught Place, Nirala Bazar | That Baat Pure Veg, Yalla Yalla Mediterranean |
| **Shegaon** | 3 | Station Road, Campus, Temple Road | Anand Pure Veg, SSGMCE Cafeteria, Gajanan Maharaj Mahaprasad |

---

## 4. Cultural & Regional Nuances Captured

1. **Maharashtrian Traditional Foods**:
   - In Kolhapur, traditional *pithla-bhakri* and *bharli vangi* are cooked with local cold-pressed groundnut oil, rendering them naturally dairy-free unless ghee is requested.
   - In Vidarbha / Nagpur, breakfast *poha* and *tarri poha* are traditionally oil-prepared, making them accessible vegan staples for students.
2. **Student Accessibility**:
   - Highlighting student-friendly budget spots near college hubs (e.g., Earthlings Cafe near Symbiosis in Pune, Fuel Station in Nagpur, FC Road eateries).
3. **Cross-Contact & Special Requests**:
   - Clear notes detailing specific communication needed by diners (e.g., requesting rotis without ghee/butter, or confirming oil tawa separation).

---

## 5. Verification Roadmap for Field Teams

To transition leads from `research_lead` to `verified`:
1. **Stage 1 (Desk Audit)**: Verify current operational status, operating hours, and active menu items via phone or official digital channels.
2. **Stage 2 (Field Visit / Volunteer Verification)**: Partner with local college student ambassadors in Pune, Mumbai, and Nagpur to conduct physical kitchen audits and photo verification.
3. **Stage 3 (Admin Clearance)**: Ingestion via the VeganSaathi Admin Review Dashboard with signed volunteer verification notes and rights-cleared photography.
