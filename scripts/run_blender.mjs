import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const candidates = [
  process.env.BLENDER_PATH,
  'C:\\Program Files\\Blender Foundation\\Blender 5.1\\blender.exe',
  'C:\\Program Files\\Blender Foundation\\Blender 5.0\\blender.exe',
  'blender',
].filter(Boolean);

const blender = candidates.find((candidate) => candidate === 'blender' || existsSync(candidate));

if (!blender) {
  console.error('Blender was not found. Install Blender 5.x or set BLENDER_PATH.');
  process.exit(1);
}

const result = spawnSync(blender, ['--background', '--python', 'scripts/create_aurora_assets.py'], {
  cwd: process.cwd(),
  stdio: 'inherit',
  shell: false,
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
