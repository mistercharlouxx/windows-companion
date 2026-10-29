const { app } = require('electron');
const { BrowserResearchSession } = require('../dist/main/browserAgent.js');
const { runFastResearch } = require('../dist/main/fastResearch.js');
app.on('window-all-closed', () => {});

async function askModel(messages) {
  const tags = await fetch('http://127.0.0.1:11434/api/tags').then(response => response.json());
  const model = tags.models?.map(item => item.name).find(name => !/embed/i.test(name));
  if (!model) throw new Error('No local chat model is installed.');
  const response = await fetch('http://127.0.0.1:11434/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model, messages, stream: false, format: 'json' }) });
  if (!response.ok) throw new Error(`Ollama returned ${response.status}.`);
  const body = await response.json(); return { text: body.message?.content || '', model };
}

app.whenReady().then(async () => {
  const browser = new BrowserResearchSession(); const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 120000);
  try {
    const result = await runFastResearch('I have 60 euros. Compare French supermarket prices and create a practical shopping list for one adult for seven days.', '', askModel, browser, (status, step) => console.log(`[${step}] ${status}`), controller.signal);
    console.log(JSON.stringify(result, null, 2)); if (!result.sources.length) throw new Error('The agent returned no observed sources.');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
  finally { clearTimeout(timer); browser.close(); app.quit(); }
});
