import { describe, expect, it } from 'vitest';
import CLAUDE from '../CLAUDE.md?raw';
import AGENTS from '../AGENTS.md?raw';
import SCHEDULED from '../docs/automation/SCHEDULED-TASKS.md?raw';

/* One rulebook and written-down scheduled runs (owner, 2026-11-20): AGENTS.md holds the rules, CLAUDE.md only points to
   it, and every scheduled agent run is in docs/automation/SCHEDULED-TASKS.md with its schedule and whole prompt. */
const files: Record<string, string> = { 'CLAUDE.md': CLAUDE, 'AGENTS.md': AGENTS, 'docs/automation/SCHEDULED-TASKS.md': SCHEDULED };
const read = (f: string) => files[f];

describe('portable agents', () => {
  it('CLAUDE.md is a short pointer to AGENTS.md', () => {
    const c = read('CLAUDE.md');
    expect(c).toContain('@AGENTS.md');
    expect(c.split('\n').length).toBeLessThanOrEqual(12);
    expect(c).not.toMatch(/^## /m);
  });
  it('AGENTS.md holds the rules', () => {
    const a = read('AGENTS.md');
    for (const h of ['## Target', '## Stack', '## Rules for the work']) expect(a).toContain(h);
  });
  it('every scheduled run has its schedule and whole prompt, and no email address', () => {
    const md = read('docs/automation/SCHEDULED-TASKS.md');
    const runs = md.split(/^## /m).slice(1);
    expect(runs.length).toBeGreaterThan(0);
    for (const r of runs) {
      expect(r).toMatch(/\*\*Schedule:\*\* `[^`]+`/);
      expect((r.match(/```text\n([\s\S]*?)\n```/)?.[1] ?? '').length).toBeGreaterThan(80);
    }
    expect(md).not.toMatch(/[\w.+-]+@(gmail|yahoo|outlook|icloud)\.com/i);
  });
});
