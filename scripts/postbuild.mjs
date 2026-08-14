import { writeFileSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

writeFileSync(
  join('dist', 'esm', 'package.json'),
  JSON.stringify({ type: 'module' }, null, 2) + '\n',
);
writeFileSync(
  join('dist', 'cjs', 'package.json'),
  JSON.stringify({ type: 'commonjs' }, null, 2) + '\n',
);

const esmDir = join('dist', 'esm');
for (const file of readdirSync(esmDir)) {
  if (!file.endsWith('.js')) continue;
  const path = join(esmDir, file);
  const source = readFileSync(path, 'utf8');
  const fixed = source.replace(
    /(from\s+['"])(\.\.?\/[^'"]+)(['"])/g,
    (match, prefix, specifier, suffix) => {
      if (specifier.endsWith('.js')) return match;
      return `${prefix}${specifier}.js${suffix}`;
    },
  );
  writeFileSync(path, fixed);
}
