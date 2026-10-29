import { app, safeStorage } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export type TaskStatus = 'inbox' | 'next' | 'waiting' | 'done';
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';
export type CompanionTask = { id: string; title: string; details?: string; status: TaskStatus; priority: TaskPriority; dueAt?: string; source: string; createdAt: string; updatedAt: string };
export type MemoryItem = { id: string; text: string; kind: 'fact' | 'preference' | 'person' | 'project' | 'decision' | 'note'; source: string; createdAt: string; embedding?: number[] };
export type AuditEntry = { id: string; action: string; target?: string; result: 'suggested' | 'confirmed' | 'completed' | 'failed'; createdAt: string; details?: string };
export type ModelProvider = 'auto' | 'openai' | 'gemini' | 'ollama';
export type CompanionSettings = { autonomyMode: 'Suggest' | 'Confirm' | 'Trusted'; startAtLogin: boolean; morningBriefingHour: number; eveningReviewHour: number; globalShortcut: string; modelProvider: ModelProvider; openAIModel?: string; geminiModel?: string; screenAwarenessEnabled: boolean };
export type CompanionData = { tasks: CompanionTask[]; memories: MemoryItem[]; audit: AuditEntry[]; settings: CompanionSettings };

const defaults: CompanionData = { tasks: [], memories: [], audit: [], settings: { autonomyMode: 'Trusted', startAtLogin: false, morningBriefingHour: 8, eveningReviewHour: 18, globalShortcut: 'CommandOrControl+Shift+Space', modelProvider: 'auto', geminiModel: 'gemini-3.8-flash', screenAwarenessEnabled: false } };
const file = () => path.join(app.getPath('userData'), 'companion-data.bin');

export function mergeCompanionData(input: Partial<CompanionData>): CompanionData {
  return { ...structuredClone(defaults), ...input, settings: { ...defaults.settings, ...(input.settings || {}) } };
}
export async function readData(): Promise<CompanionData> {
  try { const encrypted = fs.readFileSync(file()); return mergeCompanionData(JSON.parse(await safeStorage.decryptString(encrypted))); } catch { return structuredClone(defaults); }
}
export async function writeData(data: CompanionData) { fs.mkdirSync(path.dirname(file()), { recursive: true }); fs.writeFileSync(file(), await safeStorage.encryptString(JSON.stringify(data))); }
export async function listTasks(includeDone = false) { const data = await readData(); return data.tasks.filter(task => includeDone || task.status !== 'done').sort((a, b) => (a.dueAt || '9999').localeCompare(b.dueAt || '9999')); }
export async function createTask(input: Partial<CompanionTask> & Pick<CompanionTask, 'title'>) { const data = await readData(); const now = new Date().toISOString(); const task: CompanionTask = { id: randomUUID(), title: input.title.trim(), details: input.details, status: input.status || 'inbox', priority: input.priority || 'normal', dueAt: input.dueAt, source: input.source || 'companion', createdAt: now, updatedAt: now }; data.tasks.unshift(task); await writeData(data); return task; }
export async function updateTask(id: string, patch: Partial<CompanionTask>) { const data = await readData(); const index = data.tasks.findIndex(task => task.id === id); if (index < 0) throw new Error('Task not found.'); data.tasks[index] = { ...data.tasks[index], ...patch, id, updatedAt: new Date().toISOString() }; await writeData(data); return data.tasks[index]; }
export async function addMemory(input: Pick<MemoryItem, 'text' | 'kind' | 'source'> & { embedding?: number[] }) { const data = await readData(); const memory: MemoryItem = { id: randomUUID(), text: input.text.trim(), kind: input.kind, source: input.source, createdAt: new Date().toISOString(), embedding: input.embedding }; data.memories.unshift(memory); await writeData(data); return memory; }
export async function forgetMemory(id: string) { const data = await readData(); data.memories = data.memories.filter(memory => memory.id !== id); await writeData(data); }
export async function addAudit(entry: Omit<AuditEntry, 'id' | 'createdAt'>) { const data = await readData(); data.audit.unshift({ ...entry, id: randomUUID(), createdAt: new Date().toISOString() }); data.audit = data.audit.slice(0, 500); await writeData(data); }
export function cosineSimilarity(a: number[], b: number[]) { if (!a.length || a.length !== b.length) return 0; let dot = 0, aa = 0, bb = 0; for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; aa += a[i] * a[i]; bb += b[i] * b[i]; } return aa && bb ? dot / (Math.sqrt(aa) * Math.sqrt(bb)) : 0; }
export async function searchMemories(queryEmbedding: number[], limit = 8) { const data = await readData(); return data.memories.filter(memory => memory.embedding?.length).map(memory => ({ ...memory, score: cosineSimilarity(queryEmbedding, memory.embedding!) })).sort((a, b) => b.score - a.score).slice(0, limit); }
