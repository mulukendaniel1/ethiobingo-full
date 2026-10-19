// src/routes/api/backup.ts
import { Router } from 'express';
import { backupService } from '../../services/BackupService';
import { logger } from '../../core/utils/logger';
import { getSettings } from '../../core/utils/settingsCache';
import { SystemSettings } from '../../core/database/models/SystemSettings';
import { CryptoUtils } from '../../core/utils/crypto';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import { User } from '../../core/database/models/User';

const router = Router();

async function verifyAdmin(req: any): Promise<{ user?: any; error?: string }> {
  let token = req.headers.authorization?.replace('Bearer ', '');
  if (!token && req.query.token) token = req.query.token;
  if (!token) return { error: 'No token provided' };
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { id: string; sessionId: string };
    const user = await User.findById(decoded.id).select('-password');
    if (!user || !user.isAdmin) return { error: 'Forbidden' };
    if (!user.sessionId || user.sessionId !== decoded.sessionId) return { error: 'Session expired' };
    return { user };
  } catch {
    return { error: 'Invalid token' };
  }
}

// Download backup from local file system
router.get('/download/:filename', async (req, res) => {
  try {
    const auth = await verifyAdmin(req);
    if (auth.error) return res.status(401).json({ error: auth.error });

    // Verify settings password
    const { settingsPassword } = req.query;
    if (!settingsPassword) {
      return res.status(403).json({ error: 'Settings password required' });
    }
    const settingsPassDoc = await SystemSettings.findOne({ key: 'settings_access_password' });
    if (!settingsPassDoc) return res.status(500).json({ error: 'Settings password not configured' });
    const bcrypt = await import('bcryptjs');
    const valid = await bcrypt.compare(settingsPassword as string, settingsPassDoc.value);
    if (!valid) return res.status(403).json({ error: 'Invalid settings password' });

    const { filename } = req.params;
    const history = await backupService.listBackups();
    const backup = history.find(b => b.filename === filename);
    if (!backup) return res.status(404).json({ error: 'Backup not found' });

    if (fs.existsSync(backup.localPath)) {
      res.setHeader('Content-Type', 'application/gzip');
      res.setHeader('Content-Disposition', `attachment; filename="${backup.filename}"`);
      fs.createReadStream(backup.localPath).pipe(res);
      return;
    }
    res.status(404).json({ error: 'Backup file not found on server' });
  } catch (error: any) {
    logger.error('Download backup error:', error);
    res.status(500).json({ error: 'Failed to download backup' });
  }
});

// Get backup settings and history
router.get('/settings', async (req, res) => {
  try {
    const auth = await verifyAdmin(req);
    if (auth.error) return res.status(401).json({ error: auth.error });

    const settings = getSettings();
    const history = await backupService.listBackups();
    res.json({
      backupEnabled: settings.backupEnabled,
      backupRetentionDays: settings.backupRetentionDays,
      backupCronTime: settings.backupCronTime,
      googleDriveBackupFolderId: settings.googleDriveBackupFolderId,
      hasServiceAccountKey: !!settings.googleDriveServiceAccountKeyEncrypted,
      history,
    });
  } catch (error) {
    logger.error('Get backup settings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update backup settings
router.post('/settings', async (req, res) => {
  try {
    const auth = await verifyAdmin(req);
    if (auth.error) return res.status(401).json({ error: auth.error });

    const { backupEnabled, backupRetentionDays, backupCronTime, googleDriveBackupFolderId, serviceAccountKeyJson, settingsPassword } = req.body;
    const settingsPassDoc = await SystemSettings.findOne({ key: 'settings_access_password' });
    if (!settingsPassDoc) return res.status(500).json({ error: 'Settings password not configured' });
    const bcrypt = await import('bcryptjs');
    const valid = await bcrypt.compare(settingsPassword, settingsPassDoc.value);
    if (!valid) return res.status(403).json({ error: 'Invalid password' });

    const updates: Array<{ key: string; value: any }> = [];
    if (backupEnabled !== undefined) updates.push({ key: 'backup_enabled', value: backupEnabled });
    if (backupRetentionDays !== undefined) updates.push({ key: 'backup_retention_days', value: backupRetentionDays });
    if (backupCronTime !== undefined) updates.push({ key: 'backup_cron_time', value: backupCronTime });
    if (googleDriveBackupFolderId !== undefined) updates.push({ key: 'google_drive_backup_folder_id', value: googleDriveBackupFolderId });
    if (serviceAccountKeyJson) {
      const encrypted = CryptoUtils.encrypt(serviceAccountKeyJson);
      updates.push({ key: 'google_drive_service_account_key_encrypted', value: encrypted });
    }
    for (const { key, value } of updates) {
      await SystemSettings.findOneAndUpdate({ key }, { value, updatedAt: new Date() }, { upsert: true });
    }

    const { refreshSettings } = await import('../../core/utils/settings');
    refreshSettings();
    const { loadSettings } = await import('../../core/utils/settingsCache');
    await loadSettings();

    const freshSettings = getSettings();
    res.json({
      success: true,
      settings: {
        backupEnabled: freshSettings.backupEnabled,
        backupRetentionDays: freshSettings.backupRetentionDays,
        backupCronTime: freshSettings.backupCronTime,
        googleDriveBackupFolderId: freshSettings.googleDriveBackupFolderId,
        hasServiceAccountKey: !!freshSettings.googleDriveServiceAccountKeyEncrypted,
      },
    });
  } catch (error) {
    logger.error('Update backup settings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Trigger manual backup
router.post('/manual', async (req, res) => {
  try {
    const auth = await verifyAdmin(req);
    if (auth.error) return res.status(401).json({ error: auth.error });

    backupService.createBackup()
      .then(metadata => logger.info(`Manual backup completed: ${metadata.filename}`))
      .catch(err => logger.error('Manual backup failed:', err));
    res.json({ success: true, message: 'Backup started in background' });
  } catch (error) {
    logger.error('Manual backup trigger error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/test-cron', async (req, res) => {
  try {
    const auth = await verifyAdmin(req);
    if (auth.error) return res.status(401).json({ error: auth.error });

    logger.info('🔧 Manual trigger of backup cron job...');
    const { backupService } = await import('../../services/BackupService');
    const result = await backupService.createBackup();
    await backupService.cleanupOldBackups();
    res.json({ success: true, message: `Backup created: ${result.filename}`, size: result.sizeBytes });
  } catch (error: any) {
    logger.error('Manual cron backup error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete backup (metadata only)
router.delete('/:filename', async (req, res) => {
  try {
    const auth = await verifyAdmin(req);
    if (auth.error) return res.status(401).json({ error: auth.error });

    const { filename } = req.params;
    const history = await backupService.listBackups();
    const backup = history.find(b => b.filename === filename);
    if (!backup) return res.status(404).json({ error: 'Backup not found' });
    await backupService.deleteBackup(backup.driveFileId);
    res.json({ success: true });
  } catch (error) {
    logger.error('Delete backup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;