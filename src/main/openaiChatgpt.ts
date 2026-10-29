import { app, safeStorage, shell } from 'electron';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { buildResponsesPayload, ModelMessage, parseResponseEvent } from './openaiProtocol';

const AUTHORIZATION_ENDPOINT = 'https://auth.openai.com/api/accounts/authorize';
const TOKEN_ENDPOINT = 'https://auth.openai.com/api/accounts/oauth/token';
const JWKS_ENDPOINT = 'https://auth.openai.com/.well-known/jwks.json';
const RESOURCE = 'https://api.openai.com/v1';
const SCOPES = 'openid profile email offline_access resource.invoke chatgpt.tokens.use.direct';

type OAuthTokens = { access_token: string; refresh_token?: string; id_token: string; expires_in?: number; scope?: string; token_type?: string; savedAt: number };
type Registration = { clientId: string; subject: string; email?: string; name?: string; scopes: string[]; tokens?: OAuthTokens };
type OpenAIState = { hostId: string; registration?: Registration; pendingClientId?: string };
export type ChatGPTModel = { slug: string; displayName: string };

const stateFile = () => path.join(app.getPath('userData'), 'openai-auth.bin');

async function readState(): Promise<OpenAIState> {
  try {
    const encrypted = fs.readFileSync(stateFile());
    return JSON.parse((await safeStorage.decryptStringAsync(encrypted)).result);
  } catch {
    return { hostId: `urn:uuid:${randomUUID()}` };
  }
}

async function writeState(state: OpenAIState) {
  fs.mkdirSync(path.dirname(stateFile()), { recursive: true });
  fs.writeFileSync(stateFile(), await safeStorage.encryptStringAsync(JSON.stringify(state)));
}

function base64Url(bytes: Buffer) {
  return bytes.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function scopesOf(value?: string) {
  return (value || '').split(/\s+/).filter(Boolean);
}

async function verifyIdentity(idToken: string, clientId: string, nonce: string) {
  const { createRemoteJWKSet, jwtVerify } = await import('jose');
  const result = await jwtVerify(idToken, createRemoteJWKSet(new URL(JWKS_ENDPOINT)), {
    issuer: 'https://auth.openai.com', audience: clientId
  });
  if (result.payload.nonce !== nonce) throw new Error('ChatGPT sign-in returned an invalid nonce.');
  if (!result.payload.sub) throw new Error('ChatGPT sign-in did not include an account identity.');
  return { subject: result.payload.sub, email: typeof result.payload.email === 'string' ? result.payload.email : undefined, name: typeof result.payload.name === 'string' ? result.payload.name : undefined };
}

async function exchangeCode(code: string, clientId: string, verifier: string, redirectUri: string) {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authorization_code', client_id: clientId, code, code_verifier: verifier, redirect_uri: redirectUri, resource: RESOURCE })
  });
  const body = await response.json().catch(() => ({})) as any;
  if (!response.ok) throw new Error(body.error_description || body.error || `ChatGPT token exchange failed (${response.status}).`);
  return body;
}

export async function connectChatGPT() {
  const existing = await readState();
  if (!fs.existsSync(stateFile())) await writeState(existing);
  return new Promise<Awaited<ReturnType<typeof chatGPTStatus>>>((resolve, reject) => {
    const verifier = base64Url(randomBytes(48));
    const challenge = base64Url(createHash('sha256').update(verifier).digest());
    const state = base64Url(randomBytes(32));
    const nonce = base64Url(randomBytes(32));
    let timer: NodeJS.Timeout;
    const server = http.createServer(async (request, response) => {
      const finish = () => { clearTimeout(timer); server.close(); };
      try {
        const incoming = new URL(request.url || '/', `http://${request.headers.host}`);
        if (incoming.pathname !== '/auth/callback') { response.writeHead(404); response.end(); return; }
        if (incoming.searchParams.get('state') !== state) throw new Error('ChatGPT sign-in state did not match.');
        const authorizationError = incoming.searchParams.get('error');
        if (authorizationError) throw new Error(incoming.searchParams.get('error_description') || authorizationError);
        const code = incoming.searchParams.get('code');
        if (!code) throw new Error('ChatGPT did not return an authorization code.');
        const savedClientId = existing.registration?.clientId || existing.pendingClientId;
        const returnedClientId = incoming.searchParams.get('client_id');
        const clientId = savedClientId || returnedClientId;
        if (!clientId || clientId === 'dynamic_agent_client') throw new Error('ChatGPT did not issue a client ID.');
        if (savedClientId && returnedClientId && returnedClientId !== savedClientId) throw new Error('ChatGPT returned a different client registration.');
        if (!existing.registration && returnedClientId) await writeState({ ...existing, pendingClientId: clientId });
        const redirectUri = `http://127.0.0.1:${(server.address() as any).port}/auth/callback`;
        const token = await exchangeCode(code, clientId, verifier, redirectUri);
        const identity = await verifyIdentity(token.id_token, clientId, nonce);
        if (existing.registration && existing.registration.subject !== identity.subject) throw new Error('The selected ChatGPT account does not match this saved connection. Disconnect it before switching accounts.');
        const grantedScopes = scopesOf(token.scope || incoming.searchParams.get('scope') || '');
        await writeState({ hostId: existing.hostId, registration: { clientId, ...identity, scopes: grantedScopes, tokens: { ...token, savedAt: Date.now() } } });
        response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        response.end('<h2>Companion is connected to ChatGPT.</h2><p>You can close this tab and return to Companion.</p>');
        finish(); resolve(await chatGPTStatus(true));
      } catch (error: any) {
        response.writeHead(400, { 'content-type': 'text/html; charset=utf-8' }); response.end(`<h2>Connection failed</h2><p>${String(error.message).replace(/[<>&]/g, '')}</p>`);
        finish(); reject(error);
      }
    });
    server.listen(0, '127.0.0.1', async () => {
      const redirectUri = `http://127.0.0.1:${(server.address() as any).port}/auth/callback`;
      const clientId = existing.registration?.clientId || existing.pendingClientId || 'dynamic_agent_client';
      const params: Record<string, string> = { client_id: clientId, ext_agent_host_id: existing.hostId, response_type: 'code', redirect_uri: redirectUri, scope: SCOPES, resource: RESOURCE, state, nonce, code_challenge_method: 'S256', code_challenge: challenge };
      if (!existing.registration && !existing.pendingClientId) params.agent_name_hint = 'Companion Tidal AI';
      else if (existing.registration) {
        if (existing.registration.email) params.login_hint = existing.registration.email;
        if (existing.registration.tokens?.id_token) params.id_token_hint = existing.registration.tokens.id_token;
      }
      await shell.openExternal(`${AUTHORIZATION_ENDPOINT}?${new URLSearchParams(params)}`);
    });
    timer = setTimeout(() => { server.close(); reject(new Error('ChatGPT connection timed out.')); }, 300_000);
  });
}

async function accessToken() {
  const state = await readState(); const registration = state.registration; const tokens = registration?.tokens;
  if (!registration || !tokens) throw new Error('Connect your ChatGPT account in Settings first.');
  if (!registration.scopes.includes('chatgpt.tokens.use.direct')) throw new Error('ChatGPT plan usage was not authorized. Reconnect and enable plan usage.');
  const expiresAt = tokens.savedAt + (tokens.expires_in || 3600) * 1000;
  if (Date.now() < expiresAt - 60_000) return { token: tokens.access_token, registration };
  if (!tokens.refresh_token) throw new Error('Your ChatGPT session expired. Connect it again.');
  const response = await fetch(TOKEN_ENDPOINT, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'refresh_token', client_id: registration.clientId, refresh_token: tokens.refresh_token, resource: RESOURCE }) });
  const refreshed = await response.json().catch(() => ({})) as any;
  if (!response.ok) throw new Error(refreshed.error_description || refreshed.error || 'ChatGPT session refresh failed.');
  const nextTokens = { ...tokens, ...refreshed, refresh_token: refreshed.refresh_token || tokens.refresh_token, id_token: refreshed.id_token || tokens.id_token, savedAt: Date.now() };
  const nextScopes = scopesOf(refreshed.scope).length ? scopesOf(refreshed.scope) : registration.scopes;
  await writeState({ ...state, registration: { ...registration, scopes: nextScopes, tokens: nextTokens } });
  return { token: nextTokens.access_token, registration: { ...registration, scopes: nextScopes, tokens: nextTokens } };
}

export async function listChatGPTModels(): Promise<ChatGPTModel[]> {
  const { token } = await accessToken();
  const response = await fetch(`${RESOURCE}/models`, { headers: { authorization: `Bearer ${token}` } });
  const body = await response.json().catch(() => ({})) as any;
  if (!response.ok) throw new Error(body.error?.message || body.detail || `Could not list ChatGPT models (${response.status}).`);
  return (body.models || []).filter((model: any) => model.visibility === 'list').map((model: any) => ({ slug: model.slug, displayName: model.display_name || model.slug }));
}

export async function chatGPTStatus(includeModels = false) {
  const state = await readState(); const registration = state.registration;
  if (!registration?.tokens) return { connected: false, sharing: false, models: [] as ChatGPTModel[] };
  const sharing = registration.scopes.includes('chatgpt.tokens.use.direct');
  let models: ChatGPTModel[] = [];
  let error: string | undefined;
  if (includeModels && sharing) try { models = await listChatGPTModels(); } catch (reason: any) { error = reason.message; }
  return { connected: true, sharing, email: registration.email, name: registration.name, models, error };
}

export async function disconnectChatGPT() {
  const state = await readState(); const registration = state.registration;
  if (registration?.tokens?.refresh_token) {
    try {
      const discovery = await fetch('https://auth.openai.com/.well-known/openid-configuration').then(response => response.json()) as any;
      if (discovery.revocation_endpoint) await fetch(discovery.revocation_endpoint, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token: registration.tokens.refresh_token, token_type_hint: 'refresh_token', client_id: registration.clientId }) });
    } catch { /* local disconnection still proceeds */ }
  }
  await writeState({ hostId: state.hostId, registration: registration ? { ...registration, tokens: undefined } : undefined });
  return chatGPTStatus();
}

export async function chatGPTRequest(messages: ModelMessage[], preferredModel?: string, imageDataUrl?: string) {
  const { token } = await accessToken();
  const models = await listChatGPTModels();
  const model = models.find(candidate => candidate.slug === preferredModel)?.slug || models[0]?.slug;
  if (!model) throw new Error('No ChatGPT models are available for this account.');
  const response = await fetch(`${RESOURCE}/responses`, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(buildResponsesPayload(messages, model, imageDataUrl)) });
  if (!response.ok || !response.body) {
    const failure = await response.json().catch(() => ({})) as any;
    throw new Error(failure.error?.message || failure.detail || `ChatGPT returned ${response.status}.`);
  }
  const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = ''; let text = ''; let completed = false;
  while (true) {
    const { value, done } = await reader.read(); buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
    const frames = buffer.split(/\r?\n\r?\n/); buffer = frames.pop() || '';
    for (const frame of frames) for (const line of frame.split(/\r?\n/)) if (line.startsWith('data: ')) {
      const parsed = parseResponseEvent(line.slice(6));
      if (parsed.type === 'delta') text += parsed.text;
      if (parsed.type === 'failed') throw new Error(parsed.text);
      if (parsed.type === 'completed') completed = true;
    }
    if (done) break;
  }
  if (!completed) throw new Error('ChatGPT disconnected before completing the response.');
  return { text: text.trim(), model, provider: 'openai' as const };
}
