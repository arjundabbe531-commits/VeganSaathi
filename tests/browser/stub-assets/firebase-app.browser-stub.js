/* TEST-ONLY stub Firebase App SDK — for offline sandbox verification only. */
export function initializeApp(config) {
  if (!config || !config.apiKey) throw new Error("stub: missing config.apiKey");
  return { name: "[STUB_APP]", options: config };
}
