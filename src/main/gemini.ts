import { app, safeStorage } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { buildGeminiPayload, extractGeminiText, GEMINI_MODELS, GeminiMessage, normalizeGeminiModel } from './geminiProtocol';

type GeminiState = { apiKey: string };
const stateFile = () => path.join(app.getPath('userData'), 'gemini-auth.bin');

function readState(): GeminiState | null {
  try { return JSON.parse(safeStorage.decryptString(fs.readFileSync(stateFile()))); } catch { return null; }
}

function writeState(state: GeminiState) {
  if (!safeStorage.isEncryptionAvailable()) throw new Error('Windows secure storage is unavailable. The Gemini key was not saved.');
  fs.mkdirSync(path.dirname(stateFile()), { recursive: true });
  fs.writeFileSync(stateFile(), safeStorage.encryptString(JSON.stringify(state)));
}

async function parseFailure(response: Response) {
  const body = await response.json().catch(() => ({})) as any;
  const message = body?.error?.message;
  if (response.status === 400) return message || 'Gemini rejected the request.';
  if (response.status === 401 || response.status === 403) return 'Gemini rejected the API key or this key does not have access.';
  if (response.status === 429) return 'Gemini rate limit or quota exceeded.';
  return message || `Gemini returned ${response.status}.`;
}

async function validateKey(apiKey: string, model: string) {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}`, { headers: { 'x-goog-api-key': apiKey } });
  if (!response.ok) throw new Error(await parseFailure(response));
}

export async function configureGemini(apiKey: string, model?: string) {
  const clean = apiKey.trim();
  if (!clean) throw new Error('Enter a Gemini API key.');
  const selectedModel = normalizeGeminiModel(model);
  await validateKey(clean, selectedModel);
  writeState({ apiKey: clean });
  return geminiStatus(selectedModel);
}

export function geminiStatus(model?: string) {
  const state = readState();
  return { configured: Boolean(state?.apiKey), model: normalizeGeminiModel(model), models: GEMINI_MODELS.map(item => ({ ...item })) };
}

export function disconnectGemini() {
  try { fs.unlinkSync(stateFile()); } catch (error: any) { if (error?.code !== 'ENOENT') throw error; }
  return geminiStatus();
}

export async function geminiRequest(messages: GeminiMessage[], model?: string, imageDataUrl?: string) {
  const state = readState();
  if (!state?.apiKey) throw new Error('Add a Gemini API key in Settings before using Gemini.');
  const selectedModel = normalizeGeminiModel(model);
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(selectedModel)}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': state.apiKey },
    body: JSON.stringify(buildGeminiPayload(messages, imageDataUrl))
  });
  if (!response.ok) throw new Error(await parseFailure(response));
  const body = await response.json();
  const text = extractGeminiText(body);
  if (!text) throw new Error('Gemini returned no text. The request may have been blocked by its safety filters.');
  return { text, model: selectedModel, provider: 'gemini' as const };
}
