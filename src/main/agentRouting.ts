export function shouldUseResearchAgent(text: string) {
  const value = text.trim();
  if (value.length < 12) return false;
  if (/^(?:please\s+)?(?:open|launch|start)\b/i.test(value)) return false;
  const researchIntent = /\b(research|browse|look up|find online|compare|prices?|cheapest|best deal|shopping list|supermarkets?|websites?|sources?)\b/i.test(value);
  const multiStepIntent = /\b(plan|budget|for the week|across|all|different|options?|list|compare|check)\b/i.test(value);
  return researchIntent && multiStepIntent;
}
