import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { index: 'src/index.ts', react: 'src/react.ts' },
  format: ['esm', 'cjs'],
  // Internal workspace packages are bundled so the published SDK has no private deps.
  noExternal: [/^@xdev\/(core|shared-types)$/],
  external: ['react'],
  // paths in tsconfig.build.json make the declarations inline the shared types.
  dts: { resolve: true },
  tsconfig: 'tsconfig.build.json',
  clean: true,
  sourcemap: true,
  target: 'es2020',
  treeshake: true,
});
