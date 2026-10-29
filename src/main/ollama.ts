export type OllamaModel = { name: string; capabilities: string[] };

export function selectChatModel(models: OllamaModel[], preferred?: string) {
  const chatModels = models.filter(model => model.capabilities.includes('completion'));
  if (preferred) {
    const selected = models.find(model => model.name === preferred);
    if (!selected) throw new Error(`Configured Ollama model "${preferred}" is not installed.`);
    if (!selected.capabilities.includes('completion')) throw new Error(`Configured Ollama model "${preferred}" does not support chat.`);
    return selected.name;
  }
  if (!chatModels.length) throw new Error('Ollama is running, but no chat-capable model is installed.');
  return chatModels[0].name;
}
