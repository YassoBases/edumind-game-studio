// Removes accidental markdown fences from LLM output (```json ... ```, ```html ... ```, ```...```).
export function stripFences(s: string): string {
  let t = s.trim();
  if (t.startsWith('```')) {
    t = t.replace(/^```[a-zA-Z0-9_-]*\n?/, '');
    if (t.endsWith('```')) t = t.slice(0, -3);
  }
  return t.trim();
}

// Extract the first balanced JSON object from text that may include prose preamble.
// Returns the substring or the original if no balanced object is found.
export function extractJsonObject(s: string): string {
  const start = s.indexOf('{');
  if (start === -1) return s;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < s.length; i += 1) {
    const ch = s[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === '\\') {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return s;
}
