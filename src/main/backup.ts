import { dialog } from 'electron';
import { promises as fs } from 'node:fs';
import type { BackupResult } from '../shared/contracts';
import type { HiJapanDatabase } from './database';

export async function exportBackup(
  database: HiJapanDatabase,
): Promise<BackupResult> {
  const result = await dialog.showSaveDialog({
    title: '导出 HiJapan 学习备份',
    defaultPath: `HiJapan-backup-${new Date().toISOString().slice(0, 10)}.hijapan-backup.json`,
    filters: [{ name: 'HiJapan 备份', extensions: ['json'] }],
  });
  if (result.canceled || !result.filePath)
    return { ok: false, message: '已取消导出' };
  await fs.writeFile(
    result.filePath,
    JSON.stringify(database.exportData(), null, 2),
    'utf8',
  );
  return {
    ok: true,
    path: result.filePath,
    message: '备份已导出；API Key 不包含在备份中。',
  };
}

export async function importBackup(
  database: HiJapanDatabase,
): Promise<BackupResult> {
  const result = await dialog.showOpenDialog({
    title: '导入 HiJapan 学习备份',
    properties: ['openFile'],
    filters: [{ name: 'HiJapan 备份', extensions: ['json'] }],
  });
  if (result.canceled || !result.filePaths[0])
    return { ok: false, message: '已取消导入' };
  const raw = await fs.readFile(result.filePaths[0], 'utf8');
  const parsed = JSON.parse(raw) as unknown;
  database.importData(parsed);
  return {
    ok: true,
    path: result.filePaths[0],
    message: '备份导入成功；请重新配置 API Key。',
  };
}
