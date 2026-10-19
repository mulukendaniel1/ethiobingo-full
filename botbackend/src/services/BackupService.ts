//src\services\BackupService.ts
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { MongoClient } from 'mongodb';
import { createGzip } from 'zlib';
import { getSettings } from '../core/utils/settingsCache';
import { logger } from '../core/utils/logger';
import { SystemSettings } from '../core/database/models/SystemSettings';

const execPromise = promisify(exec);

export interface BackupMetadata {
  filename: string;
  driveFileId: string;
  sizeBytes: number;
  createdAt: Date;
  status: 'success' | 'failed';
  error?: string;
  localPath: string; // always present
}

class BackupService {
  private readonly APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwavg-eWtzKVeEFGGLs10GFxekvlhh8X6BcD382dDVvmcwpzNSvD0Lb751haUaQGA/exec';

  private async createBackupNode(localPath: string): Promise<number> {
    const client = new MongoClient(process.env.MONGODB_URI!);
    try {
      await client.connect();
      const db = client.db();
      const collections = await db.listCollections().toArray();
      const backupData: any = {};
      for (const { name } of collections) {
        backupData[name] = await db.collection(name).find({}).toArray();
      }
      const buffer = Buffer.from(JSON.stringify(backupData), 'utf-8');
      return new Promise((resolve, reject) => {
        const gzip = createGzip();
        const outStream = fs.createWriteStream(localPath);
        gzip.pipe(outStream);
        outStream.on('finish', () => resolve(fs.statSync(localPath).size));
        outStream.on('error', reject);
        gzip.on('error', reject);
        gzip.write(buffer);
        gzip.end();
      });
    } finally {
      await client.close();
    }
  }

  private async uploadViaProxy(filename: string, localPath: string, folderId: string): Promise<string> {
    const fileBuffer = fs.readFileSync(localPath);
    const base64File = fileBuffer.toString('base64');
    const payload = { filename, base64: base64File, folderId };

    const response = await fetch(this.APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Proxy upload failed: ${response.status} ${errorText}`);
    }

    interface ProxyResponse { id: string; }
    const result = (await response.json()) as ProxyResponse;
    if (!result.id) throw new Error('Proxy response missing file ID');
    return result.id;
  }

  async createBackup(): Promise<BackupMetadata> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup-${timestamp}.gz`;
    const tempPath = path.join('/tmp', filename);
    const localDir = '/app/backups';
    if (!fs.existsSync(localDir)) fs.mkdirSync(localDir, { recursive: true });
    const localPath = path.join(localDir, filename);
    let fileSize = 0;
    let driveFileId = '';

    // 1. Create backup file
    try {
      const uri = process.env.MONGODB_URI;
      if (!uri) throw new Error('MONGODB_URI missing');
      await execPromise(`mongodump --uri="${uri}" --archive=${tempPath} --gzip --numParallelCollections=1`);
      fileSize = fs.statSync(tempPath).size;
      logger.info(`mongodump backup size: ${fileSize} bytes`);
    } catch (err) {
      logger.warn('mongodump failed, using Node.js native backup');
      fileSize = await this.createBackupNode(tempPath);
      logger.info(`Node.js native backup size: ${fileSize} bytes`);
    }

    // Always keep a local copy
    fs.copyFileSync(tempPath, localPath);

    // 2. Upload to Drive via proxy (optional)
    try {
      const folderId = getSettings().googleDriveBackupFolderId;
      if (folderId) {
        driveFileId = await this.uploadViaProxy(filename, tempPath, folderId);
        logger.info(`Backup uploaded to Drive. File ID: ${driveFileId}`);
      } else {
        logger.warn('No Google Drive folder ID – skipping Drive upload');
      }
    } catch (uploadError: any) {
      logger.error('Drive upload failed:', uploadError.message);
    }

    // Cleanup temp file
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);

    const metadata: BackupMetadata = {
      filename,
      driveFileId: driveFileId || '',
      sizeBytes: fileSize,
      createdAt: new Date(),
      status: driveFileId ? 'success' : 'failed',
      error: driveFileId ? undefined : 'Drive upload failed, local copy saved',
      localPath,
    };

    await SystemSettings.findOneAndUpdate(
      { key: 'backup_history' },
      { $push: { value: metadata } },
      { upsert: true }
    );

    if (driveFileId) {
      logger.info(`✅ Backup successful: ${filename} (${fileSize} bytes) uploaded to Drive and saved locally`);
    } else {
      logger.warn(`⚠️ Backup saved only locally: ${localPath} (${fileSize} bytes)`);
    }
    return metadata;
  }

  async listBackups(): Promise<BackupMetadata[]> {
    const doc = await SystemSettings.findOne({ key: 'backup_history' });
    if (!doc?.value) return [];
    return doc.value.sort((a: BackupMetadata, b: BackupMetadata) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async deleteBackup(driveFileId: string): Promise<void> {
    // Remove metadata only (Drive deletion not implemented)
    await SystemSettings.updateOne({ key: 'backup_history' }, { $pull: { value: { driveFileId } } });
    // Optionally delete local file? We'll keep local files for safety.
  }

  async cleanupOldBackups(): Promise<void> {
  const retentionDays = getSettings().backupRetentionDays;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);
  const history = await this.listBackups();
  const toDelete = history.filter(b => b.createdAt < cutoff);
  for (const backup of toDelete) {
    // Remove from metadata
    await SystemSettings.updateOne(
      { key: 'backup_history' },
      { $pull: { value: { filename: backup.filename } } }
    );
    // Delete local file if it exists
    if (backup.localPath && fs.existsSync(backup.localPath)) {
      fs.unlinkSync(backup.localPath);
      logger.info(`Deleted local backup file: ${backup.localPath}`);
    }
    // Note: Drive files are NOT deleted automatically – they remain in Drive.
  }
  if (toDelete.length > 0) {
    logger.info(`Cleaned up ${toDelete.length} old backups (older than ${retentionDays} days)`);
  }
}
}

export const backupService = new BackupService();