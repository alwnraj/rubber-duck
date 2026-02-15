const AHA_PATTERNS = [
  /\b(oh!?|aha!?|i see|got it|that\'?s it|figured it out|found it|that was it)\b/i,
  /\b(now i understand|makes sense now|of course!?)\b/i,
  /\b(solved|fixed|working now)\b/i,
  /^yes!?\s*$/i,
  /^no!?\s+wait\b/i,
];

export function detectAha(userInput: string): boolean {
  const trimmed = userInput.trim();
  if (trimmed.length < 3) return false;
  return AHA_PATTERNS.some((p) => p.test(trimmed));
}
