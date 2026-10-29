export type GeminiMessage = { role: string; content: string };

export const GEMINI_MODELS = [
  { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash' },
  { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash-Lite' }
] as const;

export function normalizeGeminiModel(model?: string) {
  return GEMINI_MODELS.some(candidate => candidate.id === model) ? model! : GEMINI_MODELS[0].id;
}

export function buildGeminiPayload(messages: GeminiMessage[], imageDataUrl?: string, maxOutputTokens = 4096) {
  const systemText = messages.filter(message => message.role === 'system').map(message => message.content).join('\n\n');
  const contents = messages.filter(message => message.role !== 'system').map(message => ({
    role: message.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: message.content }] as ({ text: string } | { inline_data: { mime_type: string; data: string } })[]
  }));
  if (imageDataUrl) {
    const match = /^data:([^;,]+);base64,(.+)$/s.exec(imageDataUrl);
    if (!match) throw new Error('The screen capture is not a valid data image.');
    const target = contents.at(-1);
    if (!target || target.role !== 'user') throw new Error('Gemini image input requires a user message.');
    target.parts.push({ inline_data: { mime_type: match[1], data: match[2] } });
  }
  return {
    ...(systemText ? { system_instruction: { parts: [{ text: systemText }] } } : {}),
    contents,
    generationConfig: { maxOutputTokens }
  };
}

export function extractGeminiText(response: any) {
  return (response?.candidates || []).flatMap((candidate: any) => candidate?.content?.parts || []).map((part: any) => part?.text || '').join('').trim();
}
