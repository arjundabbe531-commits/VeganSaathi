# VeganSaathi — Community Access & Feature Gating Specification

**Document Version:** 1.0.0 (Phase 4 Community Update)  
**Status:** Implemented & Verified  
**Applies To:** Navigation (`frontend/js/components.js`), Submit Place (`frontend/submit-place.html`, `frontend/js/submit-place-guard.js`), Auth State (`frontend/js/auth-state.js`)

---

## 1. Guiding Principle: "Browsing is Universal; Contribution is Community-Verified"

VeganSaathi is designed to educate, inspire, and assist anyone seeking conscious plant-based and vegetarian food in Maharashtra. 

To maintain that balance between accessibility and data integrity:
- **Public Visitors (Unauthenticated):**
  - Universal, unrestricted access to browse places on **Home** and **Explore**.
  - Universal access to search the **Indian Vegan Alternatives Guide**.
  - Universal access to read all **Awareness** resources (What is Veganism, Misconceptions, Student FAQ, etc.).
  - Navigation clearly highlights: `Home`, `Explore`, `Alternatives`, `Awareness`, with `Login` and `Register` action buttons.
- **Registered Community Members (Authenticated):**
  - All public capabilities.
  - Active access to **Contribute / Submit a Place** (`submit-place.html`).
  - Access to save favorite places (`saved.html`) and leave verified reviews.
  - User profile management (`profile.html`) and personalized contribution history.
  - Navigation displays: `Home`, `Explore`, `Alternatives`, `Awareness`, `Contribute`, with `Profile` and `Logout`.

---

## 2. Interface Gating & Gate Card Architecture

### 2.1 Navigation Bar Dynamic Rendering
In `frontend/js/components.js`, `renderNavbar(activePage, user, isAdmin)` dynamically configures the links:
- When `user === null`:
  - Navigation items: `[Home, Explore, Alternatives, Awareness]`
  - Actions: `Login` and `Register`
  - "Contribute" is deliberately hidden from the primary navigation to prevent confusion for non-logged-in visitors.
- When `user !== null`:
  - Navigation items: `[Home, Explore, Alternatives, Awareness, Contribute]`
  - Actions: `Admin` (if admin), `Profile`, and `Logout`

### 2.2 Deep Link & Direct Navigation Gate (`submit-place.html`)
If an unauthenticated visitor navigates directly to `submit-place.html` (e.g. from a shared link or search engine):
1. **The Form Container (`#spFormContainer`) is Hidden**: Prevents the user from spending time filling out fields only to be surprised by an error upon submitting.
2. **The Authentication Gate Card (`#spAuthGate`) is Displayed**:
   - Features a friendly explanation of why submission is reserved for registered community members (accountability, verification credit, and quality control).
   - Provides clear action buttons:
     - **"Sign In to Your Account"** (redirects to `login.html`).
     - **"Register New Account"** (redirects to `register.html`).
   - Includes a link back to Explore for visitors who just want to browse.
3. **Live State Synchronization**: When the visitor logs in via popup or returns with an active session, `onAuthChange` automatically switches visibility—hiding `#spAuthGate` and revealing `#spFormContainer` without requiring a hard page reload.

---

## 3. Defense-in-Depth: Service-Level & Security Rules Enforcement

Gating is not merely cosmetic CSS/DOM manipulation; it is enforced across three distinct layers:

1. **UI Layer (`submit-place-guard.js`)**: Form submit handler checks `getCurrentUser()`. If null, submission halts and an alert note is displayed.
2. **Service Layer (`places-service.js`)**: `submitCommunityPlace(data, user)` strictly requires `user && user.uid`. Unauthenticated calls return `{ status: "unauthenticated" }` without firing a Firestore write.
3. **Database Layer (`firebase/firestore.rules`)**:
   ```firestore
   match /places/{placeId} {
     allow read: if resource.data.status == "published";
     allow create: if request.auth != null
                   && request.resource.data.submittedBy == request.auth.uid
                   && request.resource.data.status == "pending"
                   && request.resource.data.source == "community";
   }
   ```
   Even if a user maliciously attempts to invoke Firestore SDK directly from browser developer tools, the write is immediately rejected by Firebase Security Rules.
