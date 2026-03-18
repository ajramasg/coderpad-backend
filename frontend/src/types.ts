export interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  executionTime: number;
}

export interface Language {
  id: string;
  label: string;
  monacoId: string;
  defaultCode: string;
}
