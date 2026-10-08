// Sets XDBP_E2E from Node because `VAR=1 cmd` in an npm script does not work in Windows cmd.exe.
import { spawnSync } from 'node:child_process';

const env = { ...process.env, XDBP_E2E: '1' };
for (const args of [['build'], ['build', '-c', 'vite.content.config.ts']]) {
  const r = spawnSync('pnpm', ['exec', 'vite', ...args], { env, stdio: 'inherit', shell: true });
  if (r.status !== 0) process.exit(r.status ?? 1);
}
