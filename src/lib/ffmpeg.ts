import { constants } from 'fs';
import { access } from 'fs/promises';
import ffmpegStaticPath from 'ffmpeg-static';

async function isExecutable(path: string): Promise<boolean> {
  try {
    await access(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

export async function resolveFfmpegPath(): Promise<string | null> {
  const configuredPath = process.env.FFMPEG_PATH?.trim();
  const candidates = [configuredPath, ffmpegStaticPath].filter(
    (value): value is string => Boolean(value)
  );

  for (const candidate of candidates) {
    if (await isExecutable(candidate)) return candidate;
  }

  return null;
}
