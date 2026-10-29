export type WebSearchResult = { title: string; url: string; snippet: string; query: string };
export type WebPageEvidence = { title: string; url: string; text: string };

function decodeHtml(value: string) {
  return value.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&#(\d+);/g, (_match, code) => String.fromCharCode(Number(code))).replace(/\s+/g, ' ').trim();
}

function directDuckUrl(value: string) {
  try { const url = new URL(value, 'https://duckduckgo.com'); return url.searchParams.get('uddg') || url.toString(); } catch { return value; }
}
function directBingUrl(value:string){try{const url=new URL(value,'https://www.bing.com');const encoded=url.hostname.endsWith('bing.com')?url.searchParams.get('u'):null;if(encoded?.startsWith('a1'))return Buffer.from(encoded.slice(2),'base64url').toString('utf8');return url.toString()}catch{return value}}
function acceptedResult(url:string,requiredHost?:string){try{const host=new URL(url).hostname.replace(/^www\./,'');return !host.endsWith('bing.com')&&!host.endsWith('duckduckgo.com')&&(!requiredHost||host.endsWith(requiredHost))}catch{return false}}

export async function webSearch(query: string): Promise<WebSearchResult[]> {
  const headers={ 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36' };const requiredHost=query.match(/\bsite:([^\s]+)/i)?.[1].replace(/^www\./,'');
  const bing=await fetch(`https://www.bing.com/search?q=${encodeURIComponent(query)}`,{headers,signal:AbortSignal.timeout(12_000)});if(bing.ok){const html=await bing.text();const results:WebSearchResult[]=[];for(const block of [...html.matchAll(/<li[^>]+class="[^"]*b_algo[^"]*"[\s\S]*?<\/li>/gi)].slice(0,12)){const anchor=block[0].match(/<h2[^>]*>[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);if(!anchor)continue;const url=directBingUrl(anchor[1].replace(/&amp;/g,'&'));if(!acceptedResult(url,requiredHost))continue;const snippet=block[0].match(/<p[^>]*>([\s\S]*?)<\/p>/i)?.[1]||'';results.push({title:decodeHtml(anchor[2]),url,snippet:decodeHtml(snippet),query})}if(results.length)return results}
  const response = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, { headers, signal: AbortSignal.timeout(12_000) });
  if (!response.ok) throw new Error(`Search returned ${response.status}.`); const html = await response.text();
  const blocks = [...html.matchAll(/<div[^>]+class="[^"]*result[^"]*"[\s\S]*?<\/div>\s*<\/div>/gi)].slice(0, 12); const results: WebSearchResult[] = [];
  for (const block of blocks) {
    const anchor = block[0].match(/<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i); if (!anchor) continue;
    const snippet = block[0].match(/class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/(?:a|div)/i)?.[1] || '';
    const url = directDuckUrl(anchor[1].replace(/&amp;/g, '&')); if(!acceptedResult(url,requiredHost))continue;
    results.push({ title: decodeHtml(anchor[2]), url, snippet: decodeHtml(snippet), query });
  }
  return results;
}

export async function searchMany(queries: string[]) {
  const settled = await Promise.allSettled(queries.slice(0, 6).map(webSearch));
  return settled.flatMap(result => result.status === 'fulfilled' ? result.value : []);
}

export async function readWebPage(url: string): Promise<WebPageEvidence> {
  const parsed = new URL(url); if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Only HTTP(S) pages can be researched.');
  const response = await fetch(parsed, { headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36', accept: 'text/html,application/xhtml+xml' }, redirect: 'follow', signal: AbortSignal.timeout(12_000) });
  if (!response.ok) throw new Error(`Page returned ${response.status}.`); const html = await response.text();
  const title = decodeHtml(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || parsed.hostname);
  const clean = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<svg[\s\S]*?<\/svg>/gi, ' ');
  return { title, url: response.url, text: decodeHtml(clean).slice(0, 9000) };
}

export async function readMany(urls: string[]) {
  const settled = await Promise.allSettled(urls.slice(0, 8).map(readWebPage));
  return settled.flatMap(result => result.status === 'fulfilled' ? [result.value] : []);
}
