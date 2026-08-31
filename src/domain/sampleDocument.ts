import { parseConflicts } from './conflictParser';
import type { MergeSession } from './types';

const base = `export interface BannerOptions {
  userName: string;
  region: string;
}

export function getBanner(options: BannerOptions) {
  return options.userName;
}

export function audit(event: string) {
  return \`audit:\${event}\`;
}
`;

const current = `export interface BannerOptions {
  userName: string;
  region: string;
}

export function getBanner(options: BannerOptions) {
  return \`\${options.userName} · global\`;
}

export function audit(event: string) {
  return \`audit[current]:\${event}\`;
}
`;

const incoming = `export interface BannerOptions {
  userName: string;
  region: string;
}

export function getBanner(options: BannerOptions) {
  const locale = 'zh-CN';
  return \`\${options.userName} (\${locale})\`;
}

export function audit(event: string) {
  console.info('audit event', event);
  return \`audit:\${event}\`;
}
`;

const initialResult = `export interface BannerOptions {
  userName: string;
  region: string;
}

export function getBanner(options: BannerOptions) {
<<<<<<< HEAD
  return \`\${options.userName} · global\`;
=======
  const locale = 'zh-CN';
  return \`\${options.userName} (\${locale})\`;
>>>>>>> feature/i18n
}

export function audit(event: string) {
<<<<<<< HEAD
  return \`audit[current]:\${event}\`;
=======
  console.info('audit event', event);
  return \`audit:\${event}\`;
>>>>>>> feature/audit-log
}
`;

export const sampleSession: MergeSession = {
  base: { kind: 'base', label: 'Base', ref: 'merge base', text: base },
  current: { kind: 'current', label: 'Current', ref: 'HEAD', text: current },
  incoming: { kind: 'incoming', label: 'Incoming', ref: 'feature/i18n', text: incoming },
  initialResult,
  conflicts: parseConflicts(initialResult),
};
