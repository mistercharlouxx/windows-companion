export type ModelMessage = { role: string; content: string };

export function shouldUseScreenAwareness(text: string) {
  return /\b(?:look at|check|inspect|analy[sz]e|read|explain|fix|what(?:'s| is))\b.{0,40}\b(?:my |the |this )?(?:screen|display|window|error|page|app)\b/i.test(text)
    || /\bwhat (?:do you|can you) see\b/i.test(text);
}

export function buildResponsesPayload(messages: ModelMessage[], model: string, imageDataUrl?: string) {
  const instructions = messages.filter(message => message.role === 'system').map(message => message.content).join('\n\n');
  const conversation = messages.filter(message => message.role !== 'system').map(message => ({ role: message.role === 'assistant' ? 'assistant' : 'user', content: message.content as any }));
  if (imageDataUrl) {
    const lastUser = [...conversation].reverse().find(message => message.role === 'user');
    if (!lastUser) conversation.push({ role: 'user', content: 'Analyze this screen.' });
    const target = [...conversation].reverse().find(message => message.role === 'user')!;
    target.content = [
      { type: 'input_text', text: String(target.content) },
      { type: 'input_image', image_url: imageDataUrl, detail: 'auto' }
    ];
  }
  return { model, instructions: instructions || undefined, input: conversation, store: false, stream: true };
}

export function parseResponseEvent(data: string) {
  try {
    const event = JSON.parse(data);
    if (event.type === 'response.output_text.delta') return { type: 'delta' as const, text: String(event.delta || '') };
    if (event.type === 'response.completed') return { type: 'completed' as const, text: '' };
    if (event.type === 'response.failed' || event.type === 'response.incomplete') {
      const error = event.response?.error || event.error;
      return { type: 'failed' as const, text: error?.message || error?.code || 'The ChatGPT response did not complete.' };
    }
  } catch { /* ignore malformed keepalive events */ }
  return { type: 'other' as const, text: '' };
}
