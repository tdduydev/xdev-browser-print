// Sets XDBP_E2E from Node because `VAR=1 cmd` in an npm script does not work in Windows cmd.exe.
import { spawnSync } from 'node:child_process';

const env = { ...process.env, XDBP_E2E: '1' };
// One command string: shell is needed to resolve pnpm.cmd on Windows, and Node warns (DEP0190) on args + shell.
for (const cmd of ['pnpm exec vite build', 'pnpm exec vite build -c vite.content.config.ts']) {
  const r = spawnSync(cmd, { env, stdio: 'inherit', shell: true });
  if (r.status !== 0) process.exit(r.status ?? 1);
}
