import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { isAbsolute, join } from 'path';

function getNpmGlobalBin(): string | null {
  const candidates = [
    process.env.LOCALAPPDATA
      ? join(/*turbopackIgnore: true*/ process.env.LOCALAPPDATA, 'npm')
      : null,
    process.env.APPDATA
      ? join(/*turbopackIgnore: true*/ process.env.APPDATA, 'npm')
      : null,
    'C:\\Program Files\\nodejs',
    'C:\\Program Files (x86)\\nodejs',
  ].filter(Boolean) as string[];

  for (const dir of candidates) {
    if (
      existsSync(join(/*turbopackIgnore: true*/ dir, 'opencli.cmd')) ||
      existsSync(join(/*turbopackIgnore: true*/ dir, 'opencli'))
    ) {
      return dir;
    }
  }
  return null;
}

function resolveCommand(
  command: string,
  args: string[]
): { cmd: string; args: string[] } {
  if (process.platform !== 'win32') {
    return { cmd: command, args };
  }

  if (isAbsolute(command)) {
    return { cmd: command, args };
  }

  const npmBin = getNpmGlobalBin();
  const cmdName = `${command}.cmd`;
  const fullPath = npmBin
    ? join(/*turbopackIgnore: true*/ npmBin, cmdName)
    : cmdName;

  // On Windows, .cmd files must be executed via cmd.exe /c to avoid EINVAL.
  // Prefix with chcp 65001 so non-ASCII arguments (e.g. Chinese queries)
  // are passed and read in UTF-8 instead of the system default code page.
  return {
    cmd: 'cmd.exe',
    args: ['/c', 'chcp', '65001', '>', 'nul', '&&', fullPath, ...args],
  };
}

export function runCommand(
  command: string,
  args: string[],
  timeoutMs = 30000,
  signal?: AbortSignal
): Promise<{ stdout: string; stderr: string }> {
  const resolved = resolveCommand(command, args);
  const env = { ...process.env };
  const npmBin = getNpmGlobalBin();
  if (npmBin && env.PATH && !env.PATH.includes(npmBin)) {
    env.PATH = `${npmBin}${process.platform === 'win32' ? ';' : ':'}${env.PATH}`;
  }

  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(createAbortError());
      return;
    }

    const child = spawn(resolved.cmd, resolved.args, {
      timeout: timeoutMs,
      windowsHide: true,
      env,
    });
    let stdout = '';
    let stderr = '';
    let aborted = false;

    const onAbort = () => {
      aborted = true;
      terminateProcessTree(child.pid);
      reject(createAbortError());
    };
    signal?.addEventListener('abort', onAbort, { once: true });

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      signal?.removeEventListener('abort', onAbort);
      if (aborted) return;
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(
          new Error(
            `Command "${command} ${args.join(' ')}" exited with code ${code}: ${stderr || stdout}`
          )
        );
      }
    });

    child.on('error', (err) => {
      signal?.removeEventListener('abort', onAbort);
      if (aborted) return;
      reject(err);
    });
  });
}

function createAbortError(): Error {
  const error = new Error('抓取已停止');
  error.name = 'AbortError';
  return error;
}

function terminateProcessTree(pid: number | undefined): void {
  if (!pid) return;
  if (process.platform === 'win32') {
    const killer = spawn('taskkill', ['/PID', String(pid), '/T', '/F'], {
      windowsHide: true,
      stdio: 'ignore',
    });
    killer.unref();
    return;
  }
  try {
    process.kill(pid, 'SIGTERM');
  } catch {
    // The command may have exited between the abort signal and termination.
  }
}

export async function getOpenCLIVersion(): Promise<string | null> {
  try {
    const { stdout } = await runCommand('opencli', ['--version'], 10000);
    const version = stdout.trim();
    return version ? version : null;
  } catch {
    return null;
  }
}

export async function getDaemonStatus(): Promise<{
  running: boolean;
  extensionConnected: boolean;
  port?: number;
}> {
  try {
    const { stdout } = await runCommand('opencli', ['daemon', 'status'], 10000);
    const running = stdout.includes('Daemon: running');
    const extensionConnected = stdout.includes('Extension: connected');
    const portMatch = stdout.match(/Port:\s*(\d+)/);
    return {
      running,
      extensionConnected,
      port: portMatch ? parseInt(portMatch[1], 10) : undefined,
    };
  } catch {
    return { running: false, extensionConnected: false };
  }
}

export async function checkDouyinLogin(
  session = 'preflight-douyin'
): Promise<boolean> {
  try {
    // Open Douyin in background.
    await runCommand(
      'opencli',
      ['browser', session, 'open', 'https://www.douyin.com/', '--window', 'background'],
      30000
    );

    // Check if a user profile link exists (logged-in indicator).
    const { stdout } = await runCommand(
      'opencli',
      [
        'browser',
        session,
        'eval',
        "document.querySelector('a[href*=\"/user/\"]') !== null",
      ],
      15000
    );
    const loggedIn = stdout.trim() === 'true';

    // Clean up session.
    await runCommand('opencli', ['browser', session, 'close'], 10000).catch(
      () => {}
    );

    return loggedIn;
  } catch {
    return false;
  }
}

export async function getFFmpegVersion(): Promise<string | null> {
  try {
    const { stdout } = await runCommand('ffmpeg', ['-version'], 10000);
    const firstLine = stdout.split('\n')[0].trim();
    return firstLine || null;
  } catch {
    return null;
  }
}

export function isASRConfigured(): boolean {
  return !!process.env.ASR_API_URL;
}
