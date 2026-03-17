import { useState, useCallback, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { useSigmaData } from './hooks/useSigmaData';
import { buildSigmaPrefix, buildSigmaStdin, getSigmaVarHint } from './utils/injectData';
import './App.css';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Language {
  id: string;
  label: string;
  monacoId: string;
  defaultCode: string;
}

interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  executionTime: number;
}

// ─── Language definitions ─────────────────────────────────────────────────────

const LANGUAGES: Language[] = [
  {
    id: 'javascript',
    label: 'JavaScript',
    monacoId: 'javascript',
    defaultCode: `// JavaScript
function twoSum(nums, target) {
  const map = new Map();
  for (let i = 0; i < nums.length; i++) {
    const complement = target - nums[i];
    if (map.has(complement)) return [map.get(complement), i];
    map.set(nums[i], i);
  }
  return [];
}

console.log(twoSum([2, 7, 11, 15], 9)); // [0, 1]
console.log(twoSum([3, 2, 4], 6));       // [1, 2]
`,
  },
  {
    id: 'typescript',
    label: 'TypeScript',
    monacoId: 'typescript',
    defaultCode: `// TypeScript
function twoSum(nums: number[], target: number): number[] {
  const map = new Map<number, number>();
  for (let i = 0; i < nums.length; i++) {
    const complement = target - nums[i];
    if (map.has(complement)) return [map.get(complement)!, i];
    map.set(nums[i], i);
  }
  return [];
}

console.log(twoSum([2, 7, 11, 15], 9)); // [0, 1]
console.log(twoSum([3, 2, 4], 6));       // [1, 2]
`,
  },
  {
    id: 'python',
    label: 'Python',
    monacoId: 'python',
    defaultCode: `# Python
def two_sum(nums: list[int], target: int) -> list[int]:
    seen = {}
    for i, n in enumerate(nums):
        complement = target - n
        if complement in seen:
            return [seen[complement], i]
        seen[n] = i
    return []

print(two_sum([2, 7, 11, 15], 9))  # [0, 1]
print(two_sum([3, 2, 4], 6))       # [1, 2]
`,
  },
  {
    id: 'java',
    label: 'Java',
    monacoId: 'java',
    defaultCode: `// Java — class must be named Main
import java.util.*;

public class Main {
    public static int[] twoSum(int[] nums, int target) {
        Map<Integer, Integer> map = new HashMap<>();
        for (int i = 0; i < nums.length; i++) {
            int complement = target - nums[i];
            if (map.containsKey(complement)) {
                return new int[]{map.get(complement), i};
            }
            map.put(nums[i], i);
        }
        return new int[]{};
    }

    public static void main(String[] args) {
        System.out.println(Arrays.toString(twoSum(new int[]{2, 7, 11, 15}, 9)));
        System.out.println(Arrays.toString(twoSum(new int[]{3, 2, 4}, 6)));
    }
}
`,
  },
  {
    id: 'cpp',
    label: 'C++',
    monacoId: 'cpp',
    defaultCode: `// C++
#include <iostream>
#include <vector>
#include <unordered_map>
using namespace std;

vector<int> twoSum(vector<int>& nums, int target) {
    unordered_map<int, int> map;
    for (int i = 0; i < (int)nums.size(); i++) {
        int complement = target - nums[i];
        if (map.count(complement)) return {map[complement], i};
        map[nums[i]] = i;
    }
    return {};
}

int main() {
    vector<int> nums1 = {2, 7, 11, 15};
    auto r1 = twoSum(nums1, 9);
    cout << "[" << r1[0] << ", " << r1[1] << "]" << endl;

    vector<int> nums2 = {3, 2, 4};
    auto r2 = twoSum(nums2, 6);
    cout << "[" << r2[0] << ", " << r2[1] << "]" << endl;
    return 0;
}
`,
  },
  {
    id: 'c',
    label: 'C',
    monacoId: 'c',
    defaultCode: `// C
#include <stdio.h>
#include <stdlib.h>

int* twoSum(int* nums, int numsSize, int target, int* returnSize) {
    *returnSize = 2;
    int* result = malloc(2 * sizeof(int));
    for (int i = 0; i < numsSize; i++) {
        for (int j = i + 1; j < numsSize; j++) {
            if (nums[i] + nums[j] == target) {
                result[0] = i;
                result[1] = j;
                return result;
            }
        }
    }
    return result;
}

int main() {
    int nums[] = {2, 7, 11, 15};
    int returnSize;
    int* r = twoSum(nums, 4, 9, &returnSize);
    printf("[%d, %d]\\n", r[0], r[1]);
    free(r);
    return 0;
}
`,
  },
  {
    id: 'go',
    label: 'Go',
    monacoId: 'go',
    defaultCode: `// Go
package main

import "fmt"

func twoSum(nums []int, target int) []int {
	seen := make(map[int]int)
	for i, n := range nums {
		if j, ok := seen[target-n]; ok {
			return []int{j, i}
		}
		seen[n] = i
	}
	return nil
}

func main() {
	fmt.Println(twoSum([]int{2, 7, 11, 15}, 9))
	fmt.Println(twoSum([]int{3, 2, 4}, 6))
}
`,
  },
  {
    id: 'ruby',
    label: 'Ruby',
    monacoId: 'ruby',
    defaultCode: `# Ruby
def two_sum(nums, target)
  seen = {}
  nums.each_with_index do |n, i|
    complement = target - n
    return [seen[complement], i] if seen.key?(complement)
    seen[n] = i
  end
  []
end

p two_sum([2, 7, 11, 15], 9)
p two_sum([3, 2, 4], 6)
`,
  },
  {
    id: 'rust',
    label: 'Rust',
    monacoId: 'rust',
    defaultCode: `// Rust
use std::collections::HashMap;

fn two_sum(nums: &[i32], target: i32) -> Vec<usize> {
    let mut map: HashMap<i32, usize> = HashMap::new();
    for (i, &n) in nums.iter().enumerate() {
        let complement = target - n;
        if let Some(&j) = map.get(&complement) {
            return vec![j, i];
        }
        map.insert(n, i);
    }
    vec![]
}

fn main() {
    println!("{:?}", two_sum(&[2, 7, 11, 15], 9));
    println!("{:?}", two_sum(&[3, 2, 4], 6));
}
`,
  },
  {
    id: 'bash',
    label: 'Bash',
    monacoId: 'shell',
    defaultCode: `#!/bin/bash
# Bash
echo "Hello from Bash!"

# Array example
fruits=("apple" "banana" "cherry")
for fruit in "\${fruits[@]}"; do
  echo "  - $fruit"
done

# Read from stdin (if any)
if [ ! -t 0 ]; then
  echo ""
  echo "Stdin input:"
  while IFS= read -r line; do
    echo "  > $line"
  done
fi
`,
  },
  {
    id: 'php',
    label: 'PHP',
    monacoId: 'php',
    defaultCode: `<?php
// PHP
function twoSum(array $nums, int $target): array {
    $seen = [];
    foreach ($nums as $i => $n) {
        $complement = $target - $n;
        if (array_key_exists($complement, $seen)) {
            return [$seen[$complement], $i];
        }
        $seen[$n] = $i;
    }
    return [];
}

print_r(twoSum([2, 7, 11, 15], 9));
print_r(twoSum([3, 2, 4], 6));
`,
  },
];

// In production VITE_API_URL is set to the Railway backend URL.
// In development the Vite proxy forwards /api → localhost:3001.
const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function typeLabel(t: string): string {
  const map: Record<string, string> = {
    number: 'num', integer: 'int', text: 'txt',
    datetime: 'dt', boolean: 'bool', variant: 'var', link: 'url',
  };
  return map[t] ?? t;
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [language, setLanguage] = useState<Language>(LANGUAGES[0]);
  const [code, setCode] = useState(LANGUAGES[0].defaultCode);
  const [output, setOutput] = useState<ExecutionResult | null>(null);
  const [stdin, setStdin] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [activeTab, setActiveTab] = useState<'output' | 'stdin' | 'data'>('output');
  const [fontSize, setFontSize] = useState(14);
  const sigmaData = useSigmaData();
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const outputRef = useRef<HTMLDivElement>(null);

  const handleLanguageChange = useCallback((id: string) => {
    const lang = LANGUAGES.find((l) => l.id === id) ?? LANGUAGES[0];
    setLanguage(lang);
    setCode(lang.defaultCode);
    setOutput(null);
  }, []);

  const handleRun = useCallback(async () => {
    if (isRunning) return;
    setIsRunning(true);
    setActiveTab('output');

    const prefix = buildSigmaPrefix(language.id, sigmaData.rows);
    const injectedCode = prefix + code;
    const injectedStdin = buildSigmaStdin(language.id, sigmaData.rows, stdin);

    try {
      const res = await fetch(`${API_BASE}/api/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: language.id, code: injectedCode, stdin: injectedStdin }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error ?? 'Request failed');
      }

      const result: ExecutionResult = await res.json();
      setOutput(result);
    } catch (err) {
      setOutput({
        stdout: '',
        stderr: err instanceof Error ? err.message : 'Failed to connect to the backend. Is it running?',
        exitCode: 1,
        executionTime: 0,
      });
    } finally {
      setIsRunning(false);
    }
  }, [language, code, stdin, isRunning, sigmaData.rows]);

  // Keyboard shortcut: Cmd+Enter / Ctrl+Enter
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        handleRun();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleRun]);

  // Scroll output to top when new result arrives
  useEffect(() => {
    if (output && outputRef.current) {
      outputRef.current.scrollTop = 0;
    }
  }, [output]);

  const passed = output?.exitCode === 0;

  return (
    <div className="app">
      {/* ── Header ── */}
      <header className="header">
        <div className="header-left">
          <div className="logo">
            <span className="logo-bracket">&lt;/&gt;</span>
            <span className="logo-name">CoderPad</span>
          </div>

          <div className="lang-select-wrap">
            <select
              className="lang-select"
              value={language.id}
              onChange={(e) => handleLanguageChange(e.target.value)}
            >
              {LANGUAGES.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="header-right">
          <div className="font-size-ctrl">
            <button className="icon-btn" title="Decrease font size" onClick={() => setFontSize((s) => Math.max(10, s - 1))}>A⁻</button>
            <span className="font-size-label">{fontSize}px</span>
            <button className="icon-btn" title="Increase font size" onClick={() => setFontSize((s) => Math.min(24, s + 1))}>A⁺</button>
          </div>

          <button className="run-btn" onClick={handleRun} disabled={isRunning}>
            {isRunning ? (
              <>
                <span className="spinner" /> Running…
              </>
            ) : (
              <>
                <span className="run-icon">▶</span> Run
              </>
            )}
          </button>
          <span className="shortcut-hint">⌘↵</span>
        </div>
      </header>

      {/* ── Main ── */}
      <div className="main">
        {/* Editor */}
        <div className="editor-pane">
          <Editor
            height="100%"
            language={language.monacoId}
            value={code}
            onChange={(v) => setCode(v ?? '')}
            onMount={(ed) => {
              editorRef.current = ed;
            }}
            theme="vs-dark"
            options={{
              fontSize,
              fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
              fontLigatures: true,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              lineNumbers: 'on',
              renderWhitespace: 'selection',
              tabSize: 2,
              wordWrap: 'on',
              padding: { top: 16, bottom: 16 },
              smoothScrolling: true,
              cursorSmoothCaretAnimation: 'on',
              bracketPairColorization: { enabled: true },
              guides: { bracketPairs: true },
            }}
          />
        </div>

        {/* Right panel */}
        <div className="right-pane">
          <div className="tabs">
            <button
              className={`tab ${activeTab === 'output' ? 'tab-active' : ''}`}
              onClick={() => setActiveTab('output')}
            >
              Output
              {output && (
                <span className={`tab-badge ${passed ? 'badge-ok' : 'badge-err'}`}>
                  {passed ? '✓' : '✗'}
                </span>
              )}
            </button>
            <button
              className={`tab ${activeTab === 'stdin' ? 'tab-active' : ''}`}
              onClick={() => setActiveTab('stdin')}
            >
              Stdin
              {stdin && <span className="tab-dot" />}
            </button>
            <button
              className={`tab ${activeTab === 'data' ? 'tab-active' : ''}`}
              onClick={() => setActiveTab('data')}
            >
              Data
              {sigmaData.isConnected ? (
                <span className="tab-badge badge-ok">{sigmaData.rowCount}</span>
              ) : (
                <span className="sigma-tab-icon">Σ</span>
              )}
            </button>
          </div>

          <div className="panel-body">
            {activeTab === 'output' ? (
              <div className="output-wrap" ref={outputRef}>
                {isRunning && (
                  <div className="centered-msg">
                    <span className="spinner spinner-lg" />
                    <p>Executing…</p>
                  </div>
                )}

                {!isRunning && !output && (
                  <div className="centered-msg placeholder">
                    <div className="placeholder-icon">▶</div>
                    <p>Click <strong>Run</strong> or press <kbd>⌘↵</kbd> to execute</p>
                  </div>
                )}

                {!isRunning && output && (
                  <>
                    <div className="result-bar">
                      <span className={`result-status ${passed ? 'status-ok' : 'status-err'}`}>
                        {passed ? '● Exited normally' : `● Exit code ${output.exitCode}`}
                      </span>
                      <span className="result-time">{output.executionTime}ms</span>
                      <button className="clear-btn" onClick={() => setOutput(null)}>
                        Clear
                      </button>
                    </div>

                    {output.stdout && (
                      <div className="output-block">
                        <pre className="output-pre stdout-text">{output.stdout}</pre>
                      </div>
                    )}

                    {output.stderr && (
                      <div className="output-block">
                        <div className="output-block-label stderr-label">STDERR</div>
                        <pre className="output-pre stderr-text">{output.stderr}</pre>
                      </div>
                    )}

                    {!output.stdout && !output.stderr && (
                      <p className="no-output">No output produced.</p>
                    )}
                  </>
                )}
              </div>
            ) : activeTab === 'stdin' ? (
              <div className="stdin-wrap">
                <p className="stdin-hint">Provide input that will be passed to stdin when your program runs.</p>
                <textarea
                  className="stdin-area"
                  value={stdin}
                  onChange={(e) => setStdin(e.target.value)}
                  placeholder="3&#10;1 2 3&#10;..."
                  spellCheck={false}
                />
              </div>
            ) : (
              <div className="data-wrap">
                {sigmaData.isConnected ? (
                  <>
                    <div className="data-status-bar">
                      <span className="data-status-dot" />
                      <span className="data-status-text">Connected</span>
                      <span className="data-meta">{sigmaData.rowCount} rows · {sigmaData.columnMeta.length} cols</span>
                    </div>

                    <div className="data-var-hint">
                      <span className="data-var-label">Available in your code:</span>
                      <pre className="data-var-code">{getSigmaVarHint(language.id)}</pre>
                    </div>

                    <div className="data-table-wrap">
                      <table className="data-table">
                        <thead>
                          <tr>
                            {sigmaData.columnMeta.map((col) => (
                              <th key={col.id}>
                                <span className="col-name">{col.name}</span>
                                <span className="col-type">{typeLabel(col.type)}</span>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {sigmaData.rows.slice(0, 50).map((row, i) => (
                            <tr key={i}>
                              {sigmaData.columnMeta.map((col) => (
                                <td key={col.id}>{String(row[col.name] ?? '')}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {sigmaData.rowCount > 50 && (
                        <p className="data-truncation">Showing 50 of {sigmaData.rowCount} rows</p>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="centered-msg placeholder">
                    <div className="sigma-logo-large">Σ</div>
                    <p>
                      <strong>Not connected to Sigma</strong><br />
                      Add this app as a Custom Plugin in a Sigma workbook,
                      then select a data element to inject live data into your code.
                    </p>
                    <a
                      className="sigma-docs-link"
                      href="https://help.sigmacomputing.com/docs/plugins"
                      target="_blank"
                      rel="noreferrer"
                    >
                      View Sigma Plugin docs →
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
