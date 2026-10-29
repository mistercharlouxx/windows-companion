const { app } = require('electron');

app.setName('windows-companion');
app.whenReady().then(async () => {
  try {
    const { connectChatGPT } = require('../dist/main/openaiChatgpt.js');
    const status = await connectChatGPT();
    console.log(JSON.stringify({ connected: status.connected, sharing: status.sharing, email: status.email, models: status.models.map(model => model.slug) }, null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    app.quit();
  }
});
