# FIELDWORK_GUIDE.md — Collecting Real Place Data

This guide documents how the VeganSaathi team turns field visits and verified research into trustworthy listings.
VeganSaathi's primary value proposition is that listings are backed by traceable evidence and physical verification.
Everything here exists to protect that trust.

---

## 1. The Core Principles

1. **Never invent data.** No made-up places, coordinates, prices, dietary claims, reviews, or verification dates. If you don't know a value, leave the optional field empty. A smaller, honest map beats a larger, fabricated one.
2. **Global scope, local origins.** SSGMCE and Shegaon are our project origins and initial research area, **not permanent geographic restrictions**. The methodology applies anywhere in India and worldwide.
3. **Visit in person before marking anything `verified`.** A phone call, a friend's recommendation, a website, or a Google listing is desk research, not physical verification.
4. **Claim only what was confirmed.** If staff could not confirm whether a dish uses oil vs. ghee, that is "unconfirmed" — do not tag it `vegan`.
5. **Clear rights before using photos.** Only use team-taken photos where consent was granted, or images with clear open licenses (e.g., Unsplash, CC-BY). Never scrape copyrighted photos from third-party directories or review sites.
6. **Protect privacy (PII Minimization).** Record staff roles ("head chef", "mess manager"), never personal names, private phone numbers, or personal email addresses.
7. **Keep raw internal ledgers private.** The GitHub repository and frontend code are public. Raw ledgers containing internal notes, volunteer IDs, or contact sheets must remain in private, restricted-access storage.

---

## 2. Five Levels of Evidence Provenance

When evaluating any potential listing, researchers must classify evidence into one of five distinct provenance categories:

| Level | Evidence Source | Description | Eligible for `verified`? | Default Confidence |
|---|---|---|---|---|
| **E1** | **Direct In-Person Observation** | Researcher physically entered kitchen/dining area, observed preparation, inspected oil/ghee containers, and interviewed staff. | **YES** (with visit date & note) | `high` |
| **E2** | **Official Menu / Primary Website** | Direct menu printed by the establishment, official business website, or authenticated brand menu. | **NO** (unverified until visit) | `medium`–`high` |
| **E3** | **Business-Reported Statement** | Statement made by business owner or manager via phone, email, or direct correspondence without on-site visual confirmation. | **NO** (unverified until visit) | `medium` |
| **E4** | **Community-Reported Tip-Off** | Submission from app users, student survey responses, or local community tip-offs. | **NO** (unverified lead) | `low`–`medium` |
| **E5** | **Third-Party Directory** | Listings aggregated from Google Maps, Zomato, Swiggy, Justdial, etc. | **NO** (preliminary lead only) | `speculative` |

> [!IMPORTANT]
> **Strict Rule on Verification Status:**
> Online research (Levels E2, E3, E4, E5) can **NEVER** be imported with `verificationStatus = "verified"`.
> Any online lead must be imported as `verificationStatus = "unverified"` with `lastVerifiedAt = null`.
> Only Level E1 (physical in-person visit) qualifies a listing to be marked `verified`.

---

## 3. Dietary Classification Rules

A tag means **the team confirmed that at least one full meal option meets that definition.** Tag every category that applies.

| Tag | Rule for Inclusion | Critical Investigation Note |
|---|---|---|
| `vegetarian` | No meat, fish, poultry, or egg. Dairy (milk, paneer, curd, ghee) is allowed. | Most Indian "Pure Veg" restaurants qualify here. |
| `eggetarian` | Vegetarian basis + egg items permitted on menu. | Check whether eggs are cooked on the same tawa/griddle as vegetarian dishes. |
| `jain` | Free from meat, fish, eggs, **and** all underground/root vegetables (onion, garlic, potato, carrot, radish, ginger). | Always ask if Jain gravy is prepared separately or scooped from a common base containing garlic/onion. |
| `vegan` | Free from **all** animal ingredients: no meat, fish, poultry, egg, dairy (ghee, butter, curd, paneer, cream, milk), or honey. | **Vegetarian does not mean vegan.** In India, vegetarian cooking is dairy-heavy. You must verify if cooking medium is 100% vegetable oil or clarified butter (ghee). |

### Dish-Specific Questions to Ask (Never just ask "Is this vegan?")
1. **Cooking Fat:** *"Is the dal tadka, sabzi, or roti brushed with ghee, butter, or vegetable oil?"*
2. **Gravy Bases:** *"Does the gravy base use cream, milk powder, cashew paste, or curd?"*
3. **Breads:** *"Does the naan or roti dough contain milk, curd, or eggs?"*
4. **Substitutions:** *"Can this tea, coffee, or shake be prepared with soy milk or black without dairy?"*
5. **Cross-Contamination:** *"Are vegetarian/vegan items cooked on a separate tawa or using clean utensils?"*

Document the answers in `dietNotes` in factual words (e.g., *"Dal tadka prepared in refined sunflower oil on request; rotis served plain without butter. Confirmed with kitchen cook."*).

---

## 4. Coordinate Collection and Geographic Quality

Coordinates must be recorded as 5 decimal places (approx. 1 meter accuracy).
- **Format:** Decimal numbers. Latitude first (`-90` to `+90`), Longitude second (`-180` to `+180`).
- **Check Hemisphere & Inversion:** In India, latitude is positive (~8° to 37° N), longitude is positive (~68° to 97° E). If numbers appear as `76.7, 20.8`, they are inverted!
- **Null Island Warning:** Never use `0.0, 0.0` as placeholders. Records with missing coordinates must remain classified as `BLOCKED_PRELIMINARY_LEAD` in research files until coordinates are resolved.
- **Verification step:** Always copy coordinates into an offline or online mapping tool before publishing to ensure the pin lands directly on the physical doorway.

---

## 5. Media Rights & Photography Guidelines

When capturing or attributing photographs:
1. **Always ask permission** before photographing inside an establishment or taking pictures of menus/kitchens.
2. Note permission in `fieldwork_log_template.csv` under `photo_permission_granted`.
3. **Attribution & Licensing:** Every image used in the application must have clear provenance (`imageAttribution` and `imageLicense`).
   - If captured by the student team with vendor consent: `imageAttribution: "VeganSaathi Fieldwork Team"`, `imageLicense: "CC-BY-4.0"`.
   - If sourced from an open repository: `imageAttribution: "Author Name via Unsplash"`, `imageLicense: "Unsplash License"`.
   - **Never download images from Google Maps reviews, Zomato, or personal Instagram accounts** without explicit written permission from the photographer.

---

## 6. Pre-Submission Checklist

Before any fieldwork record is promoted to an app import staging file:
- [ ] Field visit documented in `research/fieldwork_log_template.csv` with visit date and staff role.
- [ ] Evidence recorded in `research/source_evidence_template.csv` with evidence level.
- [ ] Coordinates verified on a map landing on the actual entrance.
- [ ] Diet notes explain exactly how vegan/vegetarian/Jain claims were verified.
- [ ] If tagged `vegan`, explicit confirmation of no-dairy/no-ghee is recorded.
- [ ] Photo rights verified (or image field left empty).
- [ ] No personal PII (vendor phone numbers or personal names) included.
- [ ] Offline validation passed via `node scripts/validate-import.mjs`.
