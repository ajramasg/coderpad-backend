import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as ts from 'typescript';

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

const EXECUTION_TIMEOUT = 10_000; // 10 seconds
const COMPILE_TIMEOUT = 30_000;   // 30 seconds
const MAX_OUTPUT = 1024 * 512;    // 512KB

function getConfig(language: string, tmpDir: string): LanguageConfig {
  const f = (ext: string) => path.join(tmpDir, `main.${ext}`);
  const bin = path.join(tmpDir, 'main');

  const configs: Record<string, LanguageConfig> = {
    javascript: {
      filePath: f('js'),
      runArgs: ['node', f('js')],
    },
    typescript: {
      filePath: f('ts'),
      runArgs: ['node', f('js')], // js file will be transpiled from ts
    },
    python: {
      filePath: f('py'),
      runArgs: ['python3', f('py')],
    },
    java: {
      filePath: path.join(tmpDir, 'Main.java'),
      compileArgs: ['javac', path.join(tmpDir, 'Main.java')],
      runArgs: ['java', '-cp', tmpDir, 'Main'],
    },
    cpp: {
      filePath: f('cpp'),
      compileArgs: ['g++', '-std=c++17', '-O2', '-o', bin, f('cpp')],
      runArgs: [bin],
    },
    c: {
      filePath: f('c'),
      compileArgs: ['gcc', '-O2', '-o', bin, f('c')],
      runArgs: [bin],
    },
    go: {
      filePath: f('go'),
      runArgs: ['go', 'run', f('go')],
    },
    ruby: {
      filePath: f('rb'),
      runArgs: ['ruby', f('rb')],
    },
    rust: {
      filePath: f('rs'),
      compileArgs: ['rustc', '-o', bin, f('rs')],
      runArgs: [bin],
    },
    bash: {
      filePath: f('sh'),
      runArgs: ['bash', f('sh')],
    },
    php: {
      filePath: f('php'),
      runArgs: ['php', f('php')],
    },
  };

  return configs[language] ?? configs['javascript'];
}

function spawnProcess(
  args: string[],
  stdin: string,
  timeout: number
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    let settled = false;
    const [cmd, ...cmdArgs] = args;

    const proc = spawn(cmd, cmdArgs, {
      env: {
        ...process.env,
        PATH: [
          process.env.PATH,
          '/usr/local/bin',
          '/usr/bin',
          '/bin',
          '/opt/homebrew/bin',
          '/opt/homebrew/sbin',
        ].join(':'),
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
    });

    if (stdin) {
      proc.stdin.write(stdin, () => proc.stdin.end());
    } else {
      proc.stdin.end();
    }

    proc.on('close', (code) => {
      if (!settled) {
        settled = true;
        resolve({ stdout, stderr, exitCode: code ?? 0 });
      }
    });

    proc.on('error', (err) => {
      if (!settled) {
        settled = true;
        resolve({ stdout, stderr: `Error: ${err.message}`, exitCode: 1 });
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
  stdin = ''
): Promise<ExecutionResult> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'coderpad-'));
  const start = Date.now();

  try {
    const config = getConfig(language, tmpDir);
    fs.writeFileSync(config.filePath, code, 'utf-8');

    // TypeScript: transpile to JS before running
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
          .map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n'))
          .join('\n');
        return { stdout: '', stderr: errors, exitCode: 1, executionTime: Date.now() - start };
      }

      const jsPath = path.join(tmpDir, 'main.js');
      fs.writeFileSync(jsPath, outputText);
    }

    // Compile step (C, C++, Java, Rust)
    if (config.compileArgs) {
      const compile = await spawnProcess(config.compileArgs, '', COMPILE_TIMEOUT);
      if (compile.exitCode !== 0) {
        return {
          stdout: compile.stdout,
          stderr: compile.stderr || 'Compilation failed',
          exitCode: compile.exitCode,
          executionTime: Date.now() - start,
        };
      }
    }

    // Execute
    const run = await spawnProcess(config.runArgs, stdin, EXECUTION_TIMEOUT);
    return { ...run, executionTime: Date.now() - start };
  } catch (err) {
    return {
      stdout: '',
      stderr: err instanceof Error ? err.message : 'Unknown error',
      exitCode: 1,
      executionTime: Date.now() - start,
    };
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}
