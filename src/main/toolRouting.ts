export type RoutedToolAction = { tool: 'windows_automation'; args: { steps: any[] }; description: string };

type ConversationMessage = { role: string; content: string };

const unsafeTarget = (target: string) => /[\\/]|^[a-z]:|^https?:|\.(?:txt|pdf|docx?|xlsx?|png|jpe?g)$/i.test(target.trim());

export function routeContextualWindowsIntent(messages: ConversationMessage[]): RoutedToolAction | null {
  let lastUserIndex = -1;
  for (let index = messages.length - 1; index >= 0; index--) {
    if (messages[index].role === 'user') { lastUserIndex = index; break; }
  }
  if (lastUserIndex < 0) return null;
  const request = messages[lastUserIndex].content.trim().replace(/[.!?]+$/, '');
  const asksForPreviousAnswerInNotepad = /^(?:please\s+)?(?:put|paste|write|copy|send)\s+(?:them|it|that|this|the\s+list|my\s+list)(?:\s+all)?\s+(?:in|into|to)\s+(?:my\s+)?notepad$/i.test(request);
  if (!asksForPreviousAnswerInNotepad) return null;
  const previousAnswer = messages.slice(0, lastUserIndex).reverse().find(message => message.role === 'assistant' && message.content.trim())?.content.trim();
  if (!previousAnswer) return null;
  return {
    tool: 'windows_automation',
    args: { steps: [
      { action: 'launch', target: 'Notepad' },
      { action: 'type_text', text: previousAnswer, application: 'Notepad' }
    ] },
    description: 'Open Notepad and paste the previous answer'
  };
}

export function routeDeterministicWindowsIntent(input: string): RoutedToolAction | null {
  const text = input.trim().replace(/[.!?]+$/, '');
  if (!text || /^(?:what|why|when|where|who|how|can|could|would|should|is|are|do|does)\b/i.test(text)) return null;

  const openAndType = text.match(/^(?:please\s+)?(?:open|launch|start)\s+(.+?)\s+(?:and\s+)?(?:then\s+)?(?:type|write|enter)\s+(.+)$/i);
  const vagueDeliverable = openAndType && /^(?:my|the)\s+(?:shopping\s+list|report|plan|document|email|message|presentation|essay)$/i.test(openAndType[2].trim());
  if (vagueDeliverable) return null;
  if (openAndType && !vagueDeliverable && !unsafeTarget(openAndType[1])) return {
    tool: 'windows_automation',
    args: { steps: [
      { action: 'launch', target: openAndType[1].trim() },
      { action: 'type_text', text: openAndType[2].trim(), application: openAndType[1].trim() }
    ] },
    description: `Open ${openAndType[1].trim()} and type text`
  };

  const open = text.match(/^(?:please\s+)?(?:open|launch|start)\s+(.+)$/i);
  if (open && !unsafeTarget(open[1])) return { tool: 'windows_automation', args: { steps: [{ action: 'launch', target: open[1].trim() }] }, description: `Open ${open[1].trim()}` };

  const type = text.match(/^(?:please\s+)?(?:type|write|enter)\s+(.+?)\s+(?:in|into)\s+(.+)$/i);
  if (type && !unsafeTarget(type[2])) return { tool: 'windows_automation', args: { steps: [{ action: 'type_text', text: type[1].trim(), application: type[2].trim() }] }, description: `Type text in ${type[2].trim()}` };

  if (/\b(?:pause|play|resume)\b.*\b(?:music|media|song|video|playback)\b/i.test(text)) return { tool: 'windows_automation', args: { steps: [{ action: 'media', command: 'play_pause' }] }, description: 'Toggle media playback' };
  if (/\b(?:next|skip)\b.*\b(?:song|track|media|video)\b/i.test(text)) return { tool: 'windows_automation', args: { steps: [{ action: 'media', command: 'next' }] }, description: 'Play next media item' };
  if (/\b(?:previous|last|back)\b.*\b(?:song|track|media|video)\b/i.test(text)) return { tool: 'windows_automation', args: { steps: [{ action: 'media', command: 'previous' }] }, description: 'Play previous media item' };
  if (/\bmute\b/i.test(text)) return { tool: 'windows_automation', args: { steps: [{ action: 'volume', command: 'mute' }] }, description: 'Mute or unmute volume' };
  if (/\b(?:raise|increase|turn up|volume up)\b.*\b(?:volume|sound)?\b/i.test(text)) return { tool: 'windows_automation', args: { steps: [{ action: 'volume', command: 'volume_up' }] }, description: 'Increase volume' };
  if (/\b(?:lower|decrease|turn down|volume down)\b.*\b(?:volume|sound)?\b/i.test(text)) return { tool: 'windows_automation', args: { steps: [{ action: 'volume', command: 'volume_down' }] }, description: 'Decrease volume' };
  return null;
}
