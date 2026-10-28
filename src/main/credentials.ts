import { app, safeStorage } from 'electron';
import { promises as fs } from 'node:fs';
import path from 'node:path';

type CredentialFile = Record<string, string>;

const credentialPath = () =>
  path.join(app.getPath('userData'), 'credentials.json');

async function readCredentials(): Promise<CredentialFile> {
  try {
    return JSON.parse(
      await fs.readFile(credentialPath(), 'utf8'),
    ) as CredentialFile;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {};
    throw error;
  }
}

export async function saveApiKey(apiKey: string) {
  if (!(await safeStorage.isAsyncEncryptionAvailable())) {
    throw new Error('SECURE_STORAGE_UNAVAILABLE');
  }
  const encrypted = await safeStorage.encryptStringAsync(apiKey);
  const credentials = await readCredentials();
  credentials.default = encrypted.toString('base64');
  await fs.writeFile(credentialPath(), JSON.stringify(credentials), {
    encoding: 'utf8',
    mode: 0o600,
  });
}

export async function loadApiKey() {
  const credentials = await readCredentials();
  const encoded = credentials.default;
  if (!encoded) return null;
  const decrypted = await safeStorage.decryptStringAsync(
    Buffer.from(encoded, 'base64'),
  );
  if (decrypted.shouldReEncrypt) await saveApiKey(decrypted.result);
  return decrypted.result;
}

export async function deleteApiKey() {
  const credentials = await readCredentials();
  delete credentials.default;
  if (Object.keys(credentials).length === 0) {
    await fs.rm(credentialPath(), { force: true });
    return;
  }
  await fs.writeFile(credentialPath(), JSON.stringify(credentials), {
    encoding: 'utf8',
    mode: 0o600,
  });
}
