const { app } = require('electron');

app.setName('windows-companion');
app.whenReady().then(async () => {
  try {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) throw new Error('Set GEMINI_API_KEY for this command.');
    const { configureGemini } = require('../dist/main/gemini.js');
    const { readData, writeData } = require('../dist/main/localData.js');
    const data = await readData();
    const status = await configureGemini(apiKey, data.settings.geminiModel);
    data.settings.modelProvider = 'gemini';
    await writeData(data);
    console.log(JSON.stringify({ configured: status.configured, provider: 'gemini', model: status.model }, null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    app.quit();
  }
});
