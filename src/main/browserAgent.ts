import { BrowserWindow } from 'electron';

export type BrowserLink = { title: string; url: string; snippet?: string };
export type BrowserControl = { index: number; kind: string; text: string; type?: string; name?: string; placeholder?: string };
export type BrowserSnapshot = { title: string; url: string; text: string; links: BrowserLink[]; controls: BrowserControl[] };

function safeHttpUrl(value: string) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('The research browser only allows HTTP(S) pages.');
  return url.toString();
}

export class BrowserResearchSession {
  private browser?: BrowserWindow;

  private ensureWindow() {
    if (this.browser && !this.browser.isDestroyed()) return this.browser;
    this.browser = new BrowserWindow({
      width: 1080, height: 760, minWidth: 760, minHeight: 520, title: 'Companion Research',
      backgroundColor: '#09090b', autoHideMenuBar: true, show: false,
      webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, partition: 'persist:companion-research' }
    });
    this.browser.webContents.setWindowOpenHandler(({ url }) => { this.open(url).catch(() => undefined); return { action: 'deny' }; });
    this.browser.on('closed', () => { this.browser = undefined; });
    return this.browser;
  }

  private async navigate(url: string) {
    const browser = this.ensureWindow(); browser.show(); browser.focus();
    await browser.loadURL(safeHttpUrl(url));
    return this.read();
  }

  async search(query: string): Promise<BrowserSnapshot> {
    if (!query?.trim()) throw new Error('A search query is required.');
    const encoded = encodeURIComponent(query.trim());
    const primary = await this.navigate(`https://www.bing.com/search?q=${encoded}`);
    const usefulPrimaryLinks = primary.links.filter(link => { try { return new URL(link.url).hostname !== 'www.bing.com'; } catch { return false; } });
    if (primary.text.length >= 300 && usefulPrimaryLinks.length >= 2) return primary;
    return this.navigate(`https://html.duckduckgo.com/html/?q=${encoded}`);
  }

  async open(url: string): Promise<BrowserSnapshot> { return this.navigate(url); }

  async read(): Promise<BrowserSnapshot> {
    const browser = this.ensureWindow();
    if (!browser.webContents.getURL()) throw new Error('No research page is open.');
    const snapshot = await browser.webContents.executeJavaScript(`(() => {
      const clean = value => String(value || '').replace(/\\s+/g, ' ').trim();
      const preferred = [...document.querySelectorAll('li.b_algo, article, main a, [data-testid="result"]')];
      const anchors = preferred.length ? preferred.flatMap(node => [...node.querySelectorAll('a[href]')]) : [...document.querySelectorAll('a[href]')];
      const seen = new Set();
      const links = [];
      for (const anchor of anchors) {
        try {
          const url = new URL(anchor.href, location.href);
          if (!/^https?:$/.test(url.protocol) || seen.has(url.href)) continue;
          const title = clean(anchor.innerText || anchor.getAttribute('aria-label'));
          if (!title || title.length < 2) continue;
          seen.add(url.href);
          const container = anchor.closest('li, article, section, div');
          links.push({ title: title.slice(0, 180), url: url.href, snippet: clean(container?.innerText).slice(0, 420) });
          if (links.length >= 24) break;
        } catch {}
      }
      const root = document.querySelector('main, article, [role="main"]') || document.body;
      const controls = [...document.querySelectorAll('input, button, [role="button"], select')].filter(node => {
        const style = getComputedStyle(node); const rect = node.getBoundingClientRect();
        return style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 2 && rect.height > 2;
      }).slice(0, 40).map((node, index) => ({ index, kind: node.tagName.toLowerCase(), text: clean(node.innerText || node.value || node.getAttribute('aria-label')).slice(0, 120), type: node.type || '', name: node.name || '', placeholder: node.placeholder || '' }));
      return { title: document.title, url: location.href, text: clean(root?.innerText).slice(0, 14000), links, controls };
    })()`, true) as BrowserSnapshot;
    snapshot.links = snapshot.links.map(link => {
      try { const url = new URL(link.url); const direct = url.hostname.endsWith('duckduckgo.com') ? url.searchParams.get('uddg') : null; return direct ? { ...link, url: direct } : link; }
      catch { return link; }
    });
    return snapshot;
  }

  async clickControl(index: number): Promise<BrowserSnapshot> {
    const browser = this.ensureWindow(); if (!Number.isInteger(index) || index < 0 || index > 39) throw new Error('Invalid page control index.');
    const result = await browser.webContents.executeJavaScript(`(() => {
      const controls = [...document.querySelectorAll('input, button, [role="button"], select')].filter(node => { const style=getComputedStyle(node); const rect=node.getBoundingClientRect(); return style.visibility!=='hidden'&&style.display!=='none'&&rect.width>2&&rect.height>2; }).slice(0,40);
      const node=controls[${index}]; if(!node) return {ok:false,error:'Control no longer exists.'};
      const label=String(node.innerText||node.value||node.getAttribute('aria-label')||'').trim();
      if(/add to|basket|cart|checkout|buy|purchase|order|subscribe|sign in|log in|account|payment/i.test(label)) return {ok:false,error:'This control could create an account, cart, order, or purchase.'};
      node.click(); return {ok:true};
    })()`, true) as { ok: boolean; error?: string };
    if (!result.ok) throw new Error(result.error || 'The page control could not be clicked.');
    await new Promise(resolve => setTimeout(resolve, 900)); return this.read();
  }

  async fillField(index: number, value: string): Promise<BrowserSnapshot> {
    const browser = this.ensureWindow(); if (!Number.isInteger(index) || index < 0 || index > 39 || !value?.trim()) throw new Error('A valid field and value are required.');
    const safeValue = JSON.stringify(value.slice(0, 180));
    const result = await browser.webContents.executeJavaScript(`(() => {
      const controls=[...document.querySelectorAll('input, button, [role="button"], select')].filter(node=>{const style=getComputedStyle(node);const rect=node.getBoundingClientRect();return style.visibility!=='hidden'&&style.display!=='none'&&rect.width>2&&rect.height>2;}).slice(0,40);
      const node=controls[${index}]; if(!(node instanceof HTMLInputElement)) return {ok:false,error:'That control is not a text field.'};
      const descriptor=(node.type+' '+node.name+' '+node.placeholder+' '+node.getAttribute('aria-label')).toLowerCase();
      if(!['text','search',''].includes(node.type)||/password|email|phone|card|payment|login|account/.test(descriptor)) return {ok:false,error:'Only safe search and location fields can be filled.'};
      const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set; setter.call(node,${safeValue}); node.dispatchEvent(new Event('input',{bubbles:true})); node.dispatchEvent(new Event('change',{bubbles:true})); node.focus(); return {ok:true};
    })()`, true) as { ok: boolean; error?: string };
    if (!result.ok) throw new Error(result.error || 'The field could not be filled.'); return this.read();
  }

  close() { if (this.browser && !this.browser.isDestroyed()) this.browser.close(); }
}
