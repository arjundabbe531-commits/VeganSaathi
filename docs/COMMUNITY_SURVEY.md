# COMMUNITY_SURVEY.md — Community Dietary Survey & Tip-Off Protocol

*Part of the VeganSaathi Community Engagement Project (CEP). This survey and interview guide gathers real community food discovery patterns, dietary hurdles, and place recommendations without collecting unnecessary personal data.*

---

## 1. Ethical Guidelines & Privacy Safeguards (PII Minimization)

VeganSaathi respects user privacy. To comply with ethical research guidelines and data privacy principles:

1. **Strictly Anonymous by Default:** Do not collect respondent names, phone numbers, student ID numbers, roll numbers, or personal home addresses.
2. **Voluntary Participation:** All questions are optional. Participants may decline to answer any question or terminate the survey at any point.
3. **No Commercial Exploitation:** Clearly inform participants that VeganSaathi is an open educational and community service project, not a commercial enterprise.
4. **Community Tip-Off Protocol:** When respondents suggest food venues, those suggestions are treated as **Level E4 (Community Tip-Offs)**. They are logged as research leads, **never published as verified venues** until confirmed through primary evidence and team visits.
5. **Secure Storage:** Raw survey responses must be stored in secure, password-protected team drives and never committed into public version control.

---

## 2. Participant Information Sheet (Script for Researchers)

> *"Hello! We are student researchers working on VeganSaathi, an open community guide helping students and residents discover vegan, vegetarian, and plant-based food options. We are conducting a short, completely anonymous 3-minute survey about food availability and dietary choices. We do not collect your name or phone number. May we ask you a few questions about your food preferences?"*

---

## 3. Section A — General User & Student Survey

*Target Audience: College students, hostel residents, faculty, and local residents.*
*Format: Online form or printed survey sheet.*

### A1. Background & Dietary Identity
1. **How do you primarily identify your dietary lifestyle?**
   - [ ] Vegan (Strictly plant-based: no meat, fish, eggs, dairy, or honey)
   - [ ] Vegetarian (Lacto-vegetarian: dairy allowed; no meat, fish, or eggs)
   - [ ] Eggetarian (Vegetarian with eggs allowed)
   - [ ] Jain (Vegetarian without root vegetables like onion, garlic, potatoes)
   - [ ] Non-Vegetarian / Flexitarian
   - [ ] Other / Prefer not to say

2. **What is your campus / residential status?**
   - [ ] Hostel resident (college mess reliant)
   - [ ] Day scholar / commuter
   - [ ] Local town/city resident
   - [ ] Visitor / traveler / pilgrim
   - [ ] Other

3. **How often do you eat out or order food per week?**
   - [ ] 0–2 times
   - [ ] 3–5 times
   - [ ] 6–10 times
   - [ ] More than 10 times

4. **What is your typical budget per meal when eating out? (Local Currency)**
   - [ ] Budget (e.g., under ₹50 / $2)
   - [ ] Moderate (e.g., ₹50–₹150 / $2–$5)
   - [ ] Premium (e.g., above ₹150 / $5)

---

### A2. Food Discovery & Trust Barriers
5. **How do you currently discover dietary-safe places? (Select all that apply)**
   - [ ] Word of mouth from peers/friends
   - [ ] Google Maps search
   - [ ] Food delivery apps (Zomato / Swiggy / UberEats)
   - [ ] Dedicated vegetarian/vegan apps (e.g., HappyCow)
   - [ ] Personal inspection / asking vendor directly
   - [ ] Social media (Instagram, WhatsApp groups)

6. **Have you ever experienced accidental consumption of unwanted ingredients (e.g. ghee, eggs, hidden animal broth)?**
   - [ ] Yes, frequently
   - [ ] Yes, occasionally
   - [ ] Rarely
   - [ ] Never, because I only eat at home/trusted kitchens

7. **What is the most frustrating issue when trying to find vegan/Jain meals?**
   - [ ] Staff do not understand what "vegan" or "no dairy/ghee" means
   - [ ] Gravies contain hidden butter or cream without disclosure
   - [ ] Lack of clear menu labeling
   - [ ] Online directory listings are outdated or inaccurate
   - [ ] High prices for plant milk alternatives

8. **What would make you trust an app recommendation most?**
   - [ ] Proof of an in-person visit with date of visit
   - [ ] Detailed notes on specific dish preparation (e.g., oil vs. ghee)
   - [ ] Photos of the kitchen/menu
   - [ ] Community reviews from other vegans/vegetarians

---

### A3. Community Place Tip-Offs (Lead Generation)
9. **Do you know of any local food venue (mess, canteen, dhaba, restaurant) that offers reliable vegan, vegetarian, or Jain options?**
   - Place Name: __________________________________________________
   - City / Locality / Landmark: ____________________________________
   - Recommended Dishes: ___________________________________________
   - What makes it good (e.g., prepares dal in oil on request, pure veg kitchen): __________________________________________________
   - Approximate Price: ____________________________________________

*(Note: Researcher enters responses from Question 9 into `research/source_evidence_template.csv` under Level E4 Community Tip-Off).*

---

## 4. Section B — Vendor Engagement & Interview Guide

*Target Audience: Mess operators, canteen managers, dhaba owners, cafe proprietors.*
*Format: Structured semi-formal interview (two student researchers present).*

### B1. Vendor Profile
- Establishment Name & Branch:
- Operational Type (Mess / Canteen / Cafe / Restaurant / Dhaba):
- Operating Hours & Days:

### B2. Dietary Awareness & Practice
1. **Cooking Medium:**
   - What oil or fat is used for frying and standard gravies? (Refined vegetable oil, mustard oil, groundnut oil, ghee, butter, blend?)
   - Are chapatis/rotis buttered automatically, or can they be served plain?
2. **Dairy Handling:**
   - Are dairy products (paneer, cream, milk, curd) stored or cooked in shared pots with other dishes?
   - Do you offer non-dairy beverages (black tea, black coffee, lemon water, fruit juices)?
3. **Jain Preparation:**
   - Can you prepare dishes strictly without onion, garlic, or root vegetables on request?
   - Is there a separate tawa or utensil used for Jain orders?
4. **Project Collaboration:**
   - May we list your verified options on VeganSaathi for students and community members? (Explain non-commercial college project status)
   - Would you agree to periodic re-verification visits (e.g., every 90 days) to confirm menu accuracy?
   - May we photograph the public menu and storefront for display in the app?

---

## 5. Survey Data Processing Workflow

```
[Raw Responses]
       │
       ▼
[Anonymization Check] (Verify zero personal contact info or PII)
       │
       ▼
[Aggregate CEP Analysis] (Summarize pain points, trust factors)
       │
       ▼
[Venue Suggestions Extracted]
       │
       ▼
[Logged to Source Evidence Ledger (Level E4)]
       │
       ▼
[Assigned to Fieldwork Team for On-Site Verification]
```
