const { app } = require('electron');

app.setName('windows-companion');
app.whenReady().then(async () => {
  try {
    const { geminiRequest } = require('../dist/main/gemini.js');
    const { readData } = require('../dist/main/localData.js');
    const data = await readData();
    const result = await geminiRequest([{ role: 'user', content: 'Reply with exactly: GEMINI_READY' }], data.settings.geminiModel);
    console.log(JSON.stringify({ ready: result.text.trim() === 'GEMINI_READY', model: result.model }, null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    app.quit();
  }
});
