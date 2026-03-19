import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as ts from 'typescript';
import { runSQL } from './sqlRunner';

export interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  executionTime: number;
}

interface LanguageConfig {
  filePath: string;
  compileArgs?: string[];
  runArgs: string[];
}

// ── Limits ────────────────────────────────────────────────────────────────────
const EXECUTION_TIMEOUT  = 10_000;  // 10 s wall-clock
const COMPILE_TIMEOUT    = 30_000;  // 30 s compile
const MAX_OUTPUT         = 256 * 1024; // 256 KB stdout
const MAX_CONCURRENT     = 40;      // simultaneous child processes
const MAX_QUEUE          = 120;     // requests waiting for a free slot
const QUEUE_TIMEOUT_MS   = 45_000;  // max time to wait in queue

// ── Slot-based execution queue ────────────────────────────────────────────────
// Instead of returning "Server busy", requests wait in line until a slot opens.
// This lets ~120 candidates click Run at once without anyone getting an error.
let activeExecutions = 0;
const waitQueue: Array<() => void> = [];

/** Acquire a slot, waiting up to QUEUE_TIMEOUT_MS if all slots are taken.
 *  Returns true if a slot was granted, false if the queue is full or timed out. */
function acquireSlot(): Promise<boolean> {
  if (activeExecutions < MAX_CONCURRENT) {
    activeExecutions++;
    return Promise.resolve(true);
  }
  if (waitQueue.length >= MAX_QUEUE) {
    return Promise.resolve(false); // queue full — only happens under extreme load
  }
  return new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => {
      const idx = waitQueue.indexOf(wake);
      if (idx >= 0) waitQueue.splice(idx, 1);
      resolve(false); // gave up waiting
    }, QUEUE_TIMEOUT_MS);

    const wake = () => {
      clearTimeout(timer);
      activeExecutions++;
      resolve(true);
    };
    waitQueue.push(wake);
  });
}

function releaseSlot(): void {
  activeExecutions--;
  if (waitQueue.length > 0) {
    const next = waitQueue.shift()!;
    next(); // hand slot directly to next waiter
  }
}

// Linux ulimit wrapper: 256 MB virtual memory, 15 s CPU, 10 MB file writes,
// 64 max user processes (fork-bomb protection), 100 open file descriptors.
function withUlimits(args: string[]): string[] {
  if (process.platform !== 'linux') return args;
  const escaped = args.map(a => "'" + a.replace(/'/g, "'\\''") + "'").join(' ');
  return [
    '/bin/bash', '-c',
    `ulimit -v 262144 -t 15 -f 20480 -u 64 -n 100 2>/dev/null; exec ${escaped}`,
  ];
}

// Strip temp-dir paths from output so internals aren't leaked to the client.
function sanitizeOutput(str: string, tmpDir: string): string {
  return str.split(tmpDir).join('<tmpdir>');
}

function getConfig(language: string, tmpDir: string): LanguageConfig {
  const f   = (ext: string) => path.join(tmpDir, `main.${ext}`);
  const bin = path.join(tmpDir, 'main');

  const configs: Record<string, LanguageConfig> = {
    javascript: {
      filePath: f('js'),
      runArgs:  ['node', f('js')],
    },
    typescript: {
      filePath: f('ts'),
      runArgs:  ['node', f('js')], // transpiled below
    },
    python: {
      filePath: f('py'),
      runArgs:  ['python3', '-I', f('py')], // -I: isolated mode (no user site-packages)
    },
    java: {
      filePath:    path.join(tmpDir, 'Main.java'),
      compileArgs: ['javac', path.join(tmpDir, 'Main.java')],
      runArgs:     [
        'java',
        // NOTE: java.security.manager was deprecated in Java 17 and REMOVED in Java 21.
        // The flag no longer has any effect on modern JVMs. Network isolation relies
        // entirely on ulimit + OS process limits. For true sandboxing, run in a
        // container with network=none.
        '-Djava.awt.headless=true',
        '-Xmx128m',   // cap heap at 128 MB
        '-Xss512k',   // cap thread stack to limit recursion bombs
        '-cp', tmpDir, 'Main',
      ],
    },
    cpp: {
      filePath:    f('cpp'),
      compileArgs: ['g++', '-std=c++17', '-O2', '-o', bin, f('cpp')],
      runArgs:     [bin],
    },
    c: {
      filePath:    f('c'),
      compileArgs: ['gcc', '-O2', '-o', bin, f('c')],
      runArgs:     [bin],
    },
    go: {
      filePath: f('go'),
      runArgs:  ['go', 'run', f('go')],
    },
    ruby: {
      filePath: f('rb'),
      runArgs:  ['ruby', '--disable-gems', f('rb')],
    },
    rust: {
      filePath:    f('rs'),
      compileArgs: ['rustc', '-o', bin, f('rs')],
      runArgs:     [bin],
    },
    bash: {
      filePath: f('sh'),
      runArgs:  ['bash', '--restricted', f('sh')], // restricted mode
    },
    php: {
      filePath: f('php'),
      runArgs:  ['php', '-n', f('php')], // -n: no php.ini extensions
    },
  };

  return configs[language] ?? configs['javascript'];
}

function spawnProcess(
  args: string[],
  stdin: string,
  timeout: number,
  tmpDir: string,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    let settled = false;
    const [cmd, ...cmdArgs] = withUlimits(args);

    const proc = spawn(cmd, cmdArgs, {
      env: {
        // Minimal, safe environment — no user secrets inherited
        PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/opt/homebrew/bin',
        HOME: os.tmpdir(),
        TMPDIR: os.tmpdir(),
        LANG: 'en_US.UTF-8',
        // Go needs these to locate the standard library
        GOPATH: process.env.GOPATH ?? '/root/go',
        GOROOT: process.env.GOROOT ?? '',
      },
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
      if (stdout.length > MAX_OUTPUT) {
        stdout = stdout.slice(0, MAX_OUTPUT) + '\n[Output truncated — limit reached]';
        proc.kill('SIGKILL');
      }
    });

    proc.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
      // Cap stderr too
      if (stderr.length > MAX_OUTPUT) {
        stderr = stderr.slice(0, MAX_OUTPUT) + '\n[Stderr truncated]';
      }
    });

    if (stdin) {
      proc.stdin.write(stdin, () => proc.stdin.end());
    } else {
      proc.stdin.end();
    }

    proc.on('close', (code) => {
      if (!settled) {
        settled = true;
        resolve({
          stdout: sanitizeOutput(stdout, tmpDir),
          stderr: sanitizeOutput(stderr, tmpDir),
          exitCode: code ?? 0,
        });
      }
    });

    proc.on('error', (err) => {
      if (!settled) {
        settled = true;
        resolve({ stdout: '', stderr: `Execution error: ${err.message}`, exitCode: 1 });
      }
    });

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        proc.kill('SIGKILL');
        resolve({
          stdout,
          stderr: stderr + '\nExecution timed out (10 second limit exceeded)',
          exitCode: 124,
        });
      }
    }, timeout);

    proc.on('close', () => clearTimeout(timer));
  });
}

export async function executeCode(
  language: string,
  code: string,
  stdin = '',
): Promise<ExecutionResult> {
  // SQL runs in-process via SQLite — no sandbox overhead, no file I/O
  if (language === 'sql') {
    return await runSQL(code);
  }

  const start = Date.now();
  const granted = await acquireSlot();
  if (!granted) {
    return {
      stdout: '',
      stderr: 'Server is at capacity — please try again in a moment.',
      exitCode: 1,
      executionTime: Date.now() - start,
    };
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'coderpad-'));

  try {
    const config = getConfig(language, tmpDir);

    // Ensure the temp dir itself is not world-writable beyond what's needed
    fs.chmodSync(tmpDir, 0o700);
    fs.writeFileSync(config.filePath, code, { encoding: 'utf-8', mode: 0o600 });

    // TypeScript: transpile to JS in-process before running
    if (language === 'typescript') {
      const tsCode = fs.readFileSync(config.filePath, 'utf-8');
      const { outputText, diagnostics } = ts.transpileModule(tsCode, {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2020,
          esModuleInterop: true,
          strict: false,
        },
        reportDiagnostics: true,
      });

      if (diagnostics && diagnostics.length > 0) {
        const errors = diagnostics
          .map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n'))
          .join('\n');
        return { stdout: '', stderr: errors, exitCode: 1, executionTime: Date.now() - start };
      }

      fs.writeFileSync(path.join(tmpDir, 'main.js'), outputText, { mode: 0o600 });
    }

    // Compile step (C, C++, Java, Rust)
    if (config.compileArgs) {
      const compile = await spawnProcess(config.compileArgs, '', COMPILE_TIMEOUT, tmpDir);
      if (compile.exitCode !== 0) {
        return {
          stdout: compile.stdout,
          stderr:  compile.stderr || 'Compilation failed',
          exitCode: compile.exitCode,
          executionTime: Date.now() - start,
        };
      }
    }

    // Execute
    const run = await spawnProcess(config.runArgs, stdin, EXECUTION_TIMEOUT, tmpDir);
    return { ...run, executionTime: Date.now() - start };

  } catch (err) {
    return {
      stdout: '',
      stderr:  err instanceof Error ? err.message : 'Unknown execution error',
      exitCode: 1,
      executionTime: Date.now() - start,
    };
  } finally {
    releaseSlot();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}
