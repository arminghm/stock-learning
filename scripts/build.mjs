import { cp, lstat, readdir, rm, mkdir } from 'node:fs/promises';
import { loadData, publicDir } from './files.mjs';

await loadData();
const output = new URL('../dist/', import.meta.url);
const entries = ['index.html', 'styles.css', 'app.js', '.nojekyll', 'assets', 'data', 'lib'];

async function copyPublic(source, target) {
  const stat = await lstat(source);
  if (stat.isSymbolicLink()) throw new Error('Symlinks cannot be published: ' + source.pathname);
  if (stat.isDirectory()) {
    await mkdir(target, { recursive: true });
    for (const name of await readdir(source)) {
      if (!name.startsWith('.') && !name.endsWith('.local.json')) {
        const child = new URL(encodeURIComponent(name), source);
        const suffix = (await lstat(child)).isDirectory() ? '/' : '';
        await copyPublic(new URL(encodeURIComponent(name) + suffix, source), new URL(encodeURIComponent(name) + suffix, target));
      }
    }
  } else if (stat.isFile()) {
    await cp(source, target);
  } else {
    throw new Error('Only regular files and directories can be published.');
  }
}

await rm(output, { recursive: true, force: true });
await mkdir(output);
for (const name of entries) {
  const input = new URL(name, publicDir);
  const directory = (await lstat(input)).isDirectory();
  await copyPublic(directory ? new URL(name + '/', publicDir) : input, new URL(directory ? name + '/' : name, output));
}
console.log('GitHub Pages artifact is ready in dist/.');
