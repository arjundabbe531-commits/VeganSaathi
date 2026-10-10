/* TEST-ONLY Node stub for firebase-firestore.js. Controlled entirely by
   test-set globals (see tests/test-places-service.mjs) rather than talking
   to a real database:
     globalThis.__STUB_DOCS__            -> array of {id, data} for collection queries
     globalThis.__STUB_DOC_BY_ID__        -> function(id) -> {id, data} | null
     globalThis.__STUB_THROW__            -> an Error to throw instead of returning, if set
*/
export function getFirestore(app) {
  return { _stub: "firestore", app: app };
}

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
  if (globalThis.__STUB_THROW__) {
    const err = globalThis.__STUB_THROW__;
    globalThis.__STUB_THROW__ = null;
    throw err;
  }
  const docs = globalThis.__STUB_DOCS__ || [];
  return {
    forEach: function (callback) {
      docs.forEach(function (d) {
        callback({ id: d.id, data: function () { return d.data; } });
      });
    }
  };
}

export function doc(db, collectionName, id) {
  return { _stub: "docRef", collectionName: collectionName, id: id };
}

export async function getDoc(docRef) {
  if (globalThis.__STUB_THROW__) {
    const err = globalThis.__STUB_THROW__;
    globalThis.__STUB_THROW__ = null;
    throw err;
  }
  const lookup = globalThis.__STUB_DOC_BY_ID__;
  const found = lookup ? lookup(docRef.id) : null;
  return {
    exists: function () { return !!found; },
    id: docRef.id,
    data: function () { return found ? found.data : undefined; }
  };
}

// Minimal Timestamp-like helper for tests to build "Firestore Timestamp"
// values without needing the real SDK.
export function makeStubTimestamp(date) {
  return { toDate: function () { return date; } };
}
