import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { getRawHeader } from '@electron/asar';
import { flipFuses, FuseV1Options, FuseVersion } from '@electron/fuses';
import { resedit } from '@electron/packager/resedit';
import { NtExecutable, NtExecutableResource } from 'resedit';

const [exeArgument, asarArgument, version, iconArgument] =
  process.argv.slice(2);

if (!exeArgument || !asarArgument || !version || !iconArgument) {
  throw new Error(
    '用法：node scripts/package/finalize-portable.mjs <exe> <app.asar> <version> <icon.ico>',
  );
}

const exePath = path.resolve(exeArgument);
const asarPath = path.resolve(asarArgument);
const iconPath = path.resolve(iconArgument);
for (const filePath of [exePath, asarPath, iconPath]) {
  if (!fs.existsSync(filePath)) throw new Error(`文件不存在：${filePath}`);
}

const executable = NtExecutable.from(fs.readFileSync(exePath));
const resources = NtExecutableResource.from(executable);
const existingIntegrity = resources.entries.filter(
  (entry) => entry.type === 'INTEGRITY' && entry.id === 'ELECTRONASAR',
);
if (existingIntegrity.length > 0) {
  throw new Error(
    '目标 EXE 已包含 ASAR 完整性记录；请从原始 Electron EXE 重新开始。',
  );
}

const { headerString } = getRawHeader(asarPath);
const asarHash = crypto.createHash('sha256').update(headerString).digest('hex');

await resedit(exePath, {
  iconPath,
  fileVersion: version,
  productVersion: version,
  productName: 'HiJapan 日语随行',
  asarIntegrity: {
    'resources\\app.asar': {
      algorithm: 'SHA256',
      hash: asarHash,
    },
  },
  win32Metadata: {
    CompanyName: 'HiJapan contributors',
    FileDescription: 'HiJapan 日语随行',
    InternalName: 'HiJapan',
    OriginalFilename: 'HiJapan 日语随行.exe',
    ProductName: 'HiJapan 日语随行',
  },
});

await flipFuses(exePath, {
  version: FuseVersion.V1,
  [FuseV1Options.RunAsNode]: false,
  [FuseV1Options.EnableCookieEncryption]: true,
  [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
  [FuseV1Options.EnableNodeCliInspectArguments]: false,
  [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
  [FuseV1Options.OnlyLoadAppFromAsar]: true,
});

console.log(`便携 EXE 已写入 ASAR 完整性记录：${asarHash}`);
