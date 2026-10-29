import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export type MediaStatus = {
  active: boolean;
  title?: string;
  artist?: string;
  album?: string;
  source?: string;
  playing?: boolean;
  positionSeconds?: number;
  durationSeconds?: number;
};

function encodedPowerShell(script: string) {
  return Buffer.from(script, 'utf16le').toString('base64');
}

async function runPowerShell(script: string, timeout = 8_000) {
  try {
    const { stdout } = await execFileAsync('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', encodedPowerShell(script)], {
      timeout,
      windowsHide: true,
      maxBuffer: 1024 * 1024
    });
    return stdout.trim();
  } catch (error: any) {
    const stderr = String(error?.stderr || '');
    if (stderr.includes('Could not find the requested application window')) throw new Error('Could not find the requested application window. Open it first or use a more exact window title.');
    throw new Error('Windows could not complete the requested action.');
  }
}

const mediaStatusScript = String.raw`
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime
[Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime] | Out-Null
function Await-WinRT($Operation, [Type]$ResultType) {
  $method = [System.WindowsRuntimeSystemExtensions].GetMethods() |
    Where-Object { $_.Name -eq 'AsTask' -and $_.IsGenericMethod -and $_.GetParameters().Count -eq 1 } |
    Select-Object -First 1
  $task = $method.MakeGenericMethod($ResultType).Invoke($null, @($Operation))
  $task.Wait()
  return $task.Result
}
$manager = Await-WinRT ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])
$session = $manager.GetCurrentSession()
if ($null -eq $session) { @{ active = $false } | ConvertTo-Json -Compress; exit }
$props = Await-WinRT ($session.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
$playback = $session.GetPlaybackInfo()
$timeline = $session.GetTimelineProperties()
@{
  active = $true
  title = [string]$props.Title
  artist = [string]$props.Artist
  album = [string]$props.AlbumTitle
  source = [string]$session.SourceAppUserModelId
  playing = ([string]$playback.PlaybackStatus -eq 'Playing')
  positionSeconds = [math]::Round($timeline.Position.TotalSeconds)
  durationSeconds = [math]::Round($timeline.EndTime.TotalSeconds)
} | ConvertTo-Json -Compress
`;

export async function getMediaStatus(): Promise<MediaStatus> {
  if (process.platform !== 'win32') return { active: false };
  try {
    const output = await runPowerShell(mediaStatusScript);
    const jsonLine = output.split(/\r?\n/).reverse().find(line => line.trim().startsWith('{'));
    return jsonLine ? JSON.parse(jsonLine) : { active: false };
  } catch {
    return { active: false };
  }
}

function payloadScript(payload: unknown, body: string) {
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
  return `$ErrorActionPreference='Stop'\n$payload=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encoded}'))|ConvertFrom-Json\n${body}`;
}

export async function launchApplication(target: string) {
  if (!target?.trim() || target.length > 500) throw new Error('A valid application or document target is required.');
  const aliases: Record<string, string> = { notepad: 'notepad.exe', calculator: 'calc.exe', calc: 'calc.exe', paint: 'mspaint.exe', explorer: 'explorer.exe', 'file explorer': 'explorer.exe', 'task manager': 'taskmgr.exe', cmd: 'cmd.exe', 'command prompt': 'cmd.exe', powershell: 'powershell.exe' };
  const resolvedTarget = aliases[target.trim().toLowerCase()] || target.trim();
  await new Promise<void>((resolve, reject) => {
    const child = spawn(resolvedTarget, [], { detached: true, windowsHide: false, stdio: 'ignore', shell: false });
    child.once('spawn', () => { child.unref(); resolve(); }); child.once('error', reject);
  });
  return { launched: target.trim() };
}

function activateBody(next: string) {
  return String.raw`
$shell = New-Object -ComObject WScript.Shell
if ($payload.application) {
  $activated = $false
  for ($attempt = 0; $attempt -lt 15; $attempt++) {
    if ($shell.AppActivate([string]$payload.application)) { $activated = $true; break }
    Start-Sleep -Milliseconds 180
  }
  if (-not $activated) { throw "Could not find the requested application window." }
  Start-Sleep -Milliseconds 180
}
${next}`;
}

export async function pasteText(application?: string) {
  await runPowerShell(payloadScript({ application: application?.trim() || '' }, activateBody("$shell.SendKeys('^v')")));
  return { typed: true, application: application?.trim() || undefined };
}

const namedKeys: Record<string, string> = {
  enter: '{ENTER}', return: '{ENTER}', tab: '{TAB}', escape: '{ESC}', esc: '{ESC}', space: ' ',
  backspace: '{BACKSPACE}', delete: '{DELETE}', up: '{UP}', down: '{DOWN}', left: '{LEFT}', right: '{RIGHT}',
  home: '{HOME}', end: '{END}', pageup: '{PGUP}', pagedown: '{PGDN}'
};

export function toSendKeys(chord: string) {
  const parts = chord.toLowerCase().split('+').map(part => part.trim()).filter(Boolean);
  if (!parts.length) throw new Error('A key chord is required.');
  let modifiers = '';
  const keys: string[] = [];
  for (const part of parts) {
    if (part === 'ctrl' || part === 'control') modifiers += '^';
    else if (part === 'alt') modifiers += '%';
    else if (part === 'shift') modifiers += '+';
    else if (namedKeys[part]) keys.push(namedKeys[part]);
    else if (/^f(?:[1-9]|1[0-2])$/.test(part)) keys.push(`{${part.toUpperCase()}}`);
    else if (/^[a-z0-9]$/.test(part)) keys.push(part);
    else throw new Error(`Unsupported key: ${part}.`);
  }
  if (keys.length !== 1) throw new Error('Use one non-modifier key per key chord.');
  return modifiers + keys[0];
}

export async function pressKeys(chord: string, application?: string) {
  const sendKeys = toSendKeys(chord);
  await runPowerShell(payloadScript({ application: application?.trim() || '', sendKeys }, activateBody('$shell.SendKeys([string]$payload.sendKeys)')));
  return { pressed: chord, application: application?.trim() || undefined };
}

const virtualKeys = { play_pause: 0xB3, next: 0xB0, previous: 0xB1, stop: 0xB2, volume_up: 0xAF, volume_down: 0xAE, mute: 0xAD } as const;
export type MediaCommand = keyof typeof virtualKeys;

export async function sendMediaKey(command: MediaCommand) {
  const key = virtualKeys[command];
  if (!key) throw new Error('Unsupported media command.');
  const script = `$ErrorActionPreference='Stop'\nAdd-Type -TypeDefinition @'\nusing System;\nusing System.Runtime.InteropServices;\npublic static class CompanionKeys { [DllImport("user32.dll")] public static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extra); }\n'@\n[CompanionKeys]::keybd_event(${key},0,0,[UIntPtr]::Zero)\n[CompanionKeys]::keybd_event(${key},0,2,[UIntPtr]::Zero)`;
  await runPowerShell(script);
  return { command };
}
