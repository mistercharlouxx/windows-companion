import { desktopCapturer, screen } from 'electron';

export async function captureCurrentDisplay() {
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const scale = Math.min(1, 1920 / display.size.width, 1200 / display.size.height);
  const thumbnailSize = { width: Math.max(1, Math.round(display.size.width * scale)), height: Math.max(1, Math.round(display.size.height * scale)) };
  const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize, fetchWindowIcons: false });
  const source = sources.find(candidate => candidate.display_id === String(display.id)) || sources[0];
  if (!source || source.thumbnail.isEmpty()) throw new Error('Windows did not provide a screen image.');
  const jpeg = source.thumbnail.toJPEG(82);
  return { dataUrl: `data:image/jpeg;base64,${jpeg.toString('base64')}`, width: source.thumbnail.getSize().width, height: source.thumbnail.getSize().height, displayId: display.id };
}
