/* TEST-ONLY stub Firestore SDK — for offline sandbox verification only.
   Controlled by window.__STUB_PROFILE__ to simulate a users/{uid} document
   (or its absence, to test the "signed in but no profile" error path).

   Task 5.5 added: a places/{id} getDoc() lookup (see the doc()/getDoc()
   functions below) searches window.__STUB_PLACES_DOCS__ by id — the same
   array the Task 5.3 collection-query stub below already uses — and
   window.__STUB_PLACE_THROW__ (singular, distinct from the plural
   __STUB_PLACES_THROW__ used by the list query) simulates a
   permission-denied/network error for a single-document fetch.
   window.__STUB_LAST_REQUESTED_PLACE_ID__ records the exact id passed to
   the most recent places/{id} getDoc() call, for tests that want direct
   proof of which id was actually requested. */
export function getFirestore(app) {
  return { _stub: "firestore", app: app };
}

export function doc(db, ...pathSegments) {
  return {
    _stub: "docRef",
    path: pathSegments.join("/"),
    collectionName: pathSegments[0],
    id: pathSegments[1]
  };
}

export async function getDoc(docRef) {
  // Routes by collection name so the same getDoc() serves both the
  // Phase-4 users/{uid} profile lookup and the Task-5.5 places/{id}
  // lookup, without either one knowing about the other's stub globals.
  if (docRef.collectionName === "places") {
    if (typeof window !== "undefined") {
      window.__STUB_LAST_REQUESTED_PLACE_ID__ = docRef.id;
    }
    if (typeof window !== "undefined" && window.__STUB_PLACE_THROW__) {
      const err = window.__STUB_PLACE_THROW__;
      window.__STUB_PLACE_THROW__ = null;
      throw err;
    }
    const docs = (typeof window !== "undefined" && window.__STUB_PLACES_DOCS__) || [];
    const found = docs.find(function (d) { return d.id === docRef.id; });
    return {
      exists: function () { return !!found; },
      id: docRef.id,
      data: function () { return found ? found.data : undefined; }
    };
  }

  // Default: users/{uid} profile lookup (unchanged Phase-4 behavior).
  const profile = (typeof window !== "undefined") ? window.__STUB_PROFILE__ : undefined;
  return {
    exists: function () { return profile !== undefined && profile !== null; },
    data: function () { return profile; }
  };
}

export async function setDoc(docRef, data) {
  if (typeof window !== "undefined") {
    window.__STUB_WRITES__ = window.__STUB_WRITES__ || [];
    window.__STUB_WRITES__.push({ path: docRef.path, data: data });
  }
  return Promise.resolve();
}

export function serverTimestamp() {
  return { _stub: "serverTimestamp" };
}

/* ---- Added for Task 5.3 (Explore -> places-service.js -> fetchPublishedPlaces) ----
   Controlled by:
     window.__STUB_PLACES_DOCS__   -> array of {id, data} returned by getDocs()
     window.__STUB_PLACES_THROW__  -> an Error to throw instead, if set (simulates
                                       permission-denied / network errors)
   Kept separate from __STUB_PROFILE__/__STUB_WRITES__ above (a different
   concern: place documents, not a user's own profile doc). */
export function collection(db, path) {
  return { _stub: "collectionRef", path: path };
}

export function query(collectionRef, ...constraints) {
  return { _stub: "query", collectionRef: collectionRef, constraints: constraints };
}

export function where(field, op, value) {
  return { _stub: "where", field: field, op: op, value: value };
}

export async function getDocs(q) {
  if (typeof window !== "undefined" && window.__STUB_PLACES_DELAY_MS__) {
    await new Promise(function (resolve) { setTimeout(resolve, window.__STUB_PLACES_DELAY_MS__); });
  }
  if (typeof window !== "undefined" && window.__STUB_PLACES_THROW__) {
    const err = window.__STUB_PLACES_THROW__;
    window.__STUB_PLACES_THROW__ = null;
    throw err;
  }
  const docs = (typeof window !== "undefined" && window.__STUB_PLACES_DOCS__) || [];
  return {
    forEach: function (callback) {
      docs.forEach(function (d) {
        callback({ id: d.id, data: function () { return d.data; } });
      });
    }
  };
}
