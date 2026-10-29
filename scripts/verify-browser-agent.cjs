const { app } = require('electron');
const { BrowserResearchSession } = require('../dist/main/browserAgent.js');

app.whenReady().then(async () => {
  const browser = new BrowserResearchSession();
  try {
    const result = await browser.search('site:carrefour.fr prix pâtes riz lait France');
    console.log(JSON.stringify({ title: result.title, url: result.url, textLength: result.text.length, links: result.links.slice(0, 3) }, null, 2));
    if (!result.links.length || !['bing.com','duckduckgo.com'].some(host => result.url.includes(host))) throw new Error('The research browser did not return search results.');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
  finally { browser.close(); app.quit(); }
});
