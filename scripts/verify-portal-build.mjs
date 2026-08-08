import { readdir, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve('dist');
const limits = { files: 1500, initialBytes: 50 * 1024 * 1024, totalBytes: 250 * 1024 * 1024 };

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else files.push({ path, size: (await stat(path)).size });
  }
  return files;
}

const files = await walk(root);
const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
const failures = [];
if (!files.some((file) => file.path.endsWith('index.html'))) failures.push('dist/index.html is missing');
if (files.length > limits.files) failures.push(`${files.length} files exceeds the 1500-file limit`);
if (totalBytes > limits.initialBytes) failures.push(`${totalBytes} bytes exceeds the 50MB initial download limit`);
if (totalBytes > limits.totalBytes) failures.push(`${totalBytes} bytes exceeds the 250MB total limit`);

if (failures.length) {
  failures.forEach((failure) => console.error(`FAIL: ${failure}`));
  process.exit(1);
}

console.log(`Portal package verified: ${files.length} files, ${(totalBytes / 1024 / 1024).toFixed(2)} MB total/initial.`);
