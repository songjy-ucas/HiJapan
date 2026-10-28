import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pngToIco from 'png-to-ico';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, '..', '..');
const sourcePath = path.join(
  projectRoot,
  'src',
  'assets',
  'app-icon-master.png',
);
const outputPath = path.join(projectRoot, 'src', 'assets', 'app-icon.ico');

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, await pngToIco(sourcePath));
console.log(`Windows 图标已生成：${path.relative(projectRoot, outputPath)}`);
