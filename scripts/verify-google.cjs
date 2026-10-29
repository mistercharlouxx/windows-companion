const { app, safeStorage } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { google } = require('googleapis');

app.setName('windows-companion');
app.whenReady().then(async () => {
  try {
    const file = path.join(app.getPath('userData'), 'google-auth.bin');
    const state = JSON.parse(await safeStorage.decryptString(fs.readFileSync(file)));
    const results = [];
    for (const [email, account] of Object.entries(state.accounts || {})) {
      const auth = new google.auth.OAuth2(state.clientId, state.clientSecret);
      auth.setCredentials(account.tokens);
      const gmail = google.gmail({ version: 'v1', auth });
      const calendar = google.calendar({ version: 'v3', auth });
      const [profile, events, unread] = await Promise.all([
        gmail.users.getProfile({ userId: 'me' }),
        calendar.events.list({ calendarId: 'primary', timeMin: new Date().toISOString(), maxResults: 1, singleEvents: true, orderBy: 'startTime' }),
        gmail.users.messages.list({ userId: 'me', q: 'is:unread', maxResults: 1 }),
      ]);
      results.push({ email: profile.data.emailAddress || email, label: account.label, primary: email === state.primaryEmail, gmail: 'ok', calendar: 'ok', upcomingSampleCount: events.data.items?.length || 0, unreadEstimate: unread.data.resultSizeEstimate || 0 });
    }
    console.log(JSON.stringify({ primaryEmail: state.primaryEmail, accounts: results }, null, 2));
  } catch (error) {
    console.error(error.message); process.exitCode = 1;
  } finally { app.quit(); }
});
