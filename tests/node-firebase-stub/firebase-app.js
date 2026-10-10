/* TEST-ONLY Node stub — mirrors firebase-app.js's real exports just enough
   for places-service.js (via firebase-init.js) to initialize without a
   network connection. Never shipped to the browser. */
export function initializeApp(config) {
  return { name: "[NODE_TEST_STUB_APP]", options: config };
}
