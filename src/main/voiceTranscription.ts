import { spawn } from 'node:child_process';
import path from 'node:path';

let activeVoiceProcess: ReturnType<typeof spawn> | undefined;

export function toWhisperLanguage(locale: string) {
  const language = locale.replace('_', '-').toLowerCase().split('-')[0];
  return /^[a-z]{2}$/.test(language) ? language : undefined;
}

export function cancelVoiceTranscription() {
  if (!activeVoiceProcess) return false;
  activeVoiceProcess.kill();
  activeVoiceProcess = undefined;
  return true;
}

export function transcribeVoice(locale = 'en-US'): Promise<string> {
  cancelVoiceTranscription();
  const script = path.resolve(__dirname, '../../scripts/voice_transcribe.py');
  const language = toWhisperLanguage(locale) || 'auto';

  return new Promise((resolve, reject) => {
    const child = spawn('python', [script, '--language', language, '--model', process.env.WHISPER_MODEL || 'base'], {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    activeVoiceProcess = child;
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk.toString(); });
    child.stderr.on('data', chunk => { stderr += chunk.toString(); });
    child.once('error', error => {
      if (activeVoiceProcess === child) activeVoiceProcess = undefined;
      reject(new Error(`Could not start local voice transcription: ${error.message}`));
    });
    child.once('close', code => {
      const wasCancelled = activeVoiceProcess !== child;
      if (activeVoiceProcess === child) activeVoiceProcess = undefined;
      if (wasCancelled) return reject(new Error('Voice transcription cancelled.'));
      const transcriptLine = stdout.split(/\r?\n/).find(line => line.startsWith('TRANSCRIPT:'));
      if (code === 0 && transcriptLine) {
        try {
          const transcript = Buffer.from(transcriptLine.slice('TRANSCRIPT:'.length), 'base64').toString('utf8').trim();
          if (transcript) return resolve(transcript);
        } catch { /* handled below */ }
      }
      if (code === 3) return reject(new Error('I did not hear a complete phrase. Click the mic, then speak normally.'));
      if (/No module named|ModuleNotFoundError/i.test(stderr)) return reject(new Error('Local voice components are missing. Run: python -m pip install faster-whisper sounddevice'));
      const detail = stderr.trim().split(/\r?\n/).filter(Boolean).at(-1);
      reject(new Error(detail ? `Local transcription failed: ${detail}` : 'Local transcription could not read the microphone.'));
    });
  });
}
