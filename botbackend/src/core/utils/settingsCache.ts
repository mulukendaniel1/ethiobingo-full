// src/core/utils/settingsCache.ts
import { SystemSettings } from '../database/models/SystemSettings';

export interface AppSettings {
  botToken: string;
  botUsername: string;
  supportUsername: string;
  channelUsername: string;
  adminIds: string;
  etbCoinEnabled: boolean;
  cbeAccountName: string;
  cbeAccountNumber: string;
  cbeInstructionsAmh: string;
  abyssiniaAccountName: string;
  abyssiniaAccountNumber: string;
  abyssiniaInstructionsAmh: string;
  cbeBirrAccountName: string;
  cbeBirrPhone: string;
  cbeBirrInstructionsAmh: string;
  telebirrAccountName: string;
  telebirrPhone: string;
  telebirrInstructionsAmh: string;
  depositEnabled: boolean;
  withdrawEnabled: boolean;
  backupEnabled: boolean;
  backupRetentionDays: number;
  backupCronTime: string;
  googleDriveBackupFolderId: string;
  googleDriveServiceAccountKeyEncrypted: string;
  gamePaused: boolean;
  referralEnabled: boolean;
  referralBonusAmount: number;
  phoneBonusEnabled: boolean;
  phoneBonusAmount: number;
  agentSystemEnabled: boolean;
  agentCommissionPercent: number;
  agentFirstDepositBonusEnabled: boolean;
  agentFirstDepositBonusHigh: number;
  agentFirstDepositBonusLow: number;
  agentMinDepositForBonusHigh: number;
  agentMinDepositForBonusLow: number;
  botNames: string;        // newline-separated string
  botCountMin: number;
  botCountMax: number;
  botsEnabled: boolean;
  botModeEnabled: boolean;
  botModeRigSeed: string;
  depositBonusEnabled: boolean;
  depositBonusPercent: number;
  depositorRewardEnabled: boolean;
  depositorRewardTopCount: number;
  depositorRewardRules: Array<{ from: number; to: number; amount: number }>;
  depositorRewardAutoEnabled: boolean;
  referrerRewardEnabled: boolean;
  referrerRewardTopCount: number;
  referrerRewardRules: Array<{ from: number; to: number; amount: number }>;
  referrerRewardAutoEnabled: boolean;
  // ── Shamo Giveaway ──
  shamoAutoEnabled: boolean;
  shamoDailyTime: string;              // "HH:MM" in Ethiopian local (UTC+3)
  shamoPrizePerButton: number;
  shamoTotalButtons: number;
  shamoEligibilityDepositDays: number;
  shamoCooldownHours: number;
  shamoBadgeEnabled: boolean;
  shamoEligibilityEnabled: boolean;
shamoMinDepositAmount: number;
}

let settings: AppSettings | null = null;

export async function loadSettings(): Promise<void> {
  const docs = await SystemSettings.find({
    key: {
      $in: [
        'bot_token', 'bot_username', 'support_username', 'channel_username', 'admin_ids',
        'etb_coin_enabled', 'cbe_account_name', 'cbe_account_number', 'cbe_instructions_amh',
        'abyssinia_account_name', 'abyssinia_account_number', 'abyssinia_instructions_amh',
        'cbe_birr_account_name', 'cbe_birr_phone', 'cbe_birr_instructions_amh',
        'telebirr_account_name', 'telebirr_phone', 'telebirr_instructions_amh',
        'deposit_enabled',
        'withdraw_enabled',
        'backup_enabled',
        'backup_retention_days',
        'backup_cron_time',
        'google_drive_backup_folder_id',
        'google_drive_service_account_key_encrypted',
        'referral_enabled',
        'referral_bonus_amount',
        'phone_bonus_enabled',
        'phone_bonus_amount',
        'agent_system_enabled',
        'agent_commission_percent',
        'agent_first_deposit_bonus_enabled',
        'agent_first_deposit_bonus_high',
        'agent_first_deposit_bonus_low',
        'agent_min_deposit_for_bonus_high',
        'agent_min_deposit_for_bonus_low',
        'bot_names',          // ✅ ADDED
        'bot_count_min',      // ✅ ADDED
        'bot_count_max',       // ✅ ADDED
        'bots_enabled',
        'bot_mode_enabled',
        'bot_mode_rig_seed',
        'deposit_bonus_enabled',
        'deposit_bonus_percent',
        'depositor_reward_enabled',
        'depositor_reward_top_count',
        'depositor_reward_rules',
        'depositor_reward_auto_enabled',
        'referrer_reward_enabled',
        'referrer_reward_top_count',
        'referrer_reward_rules',
        'referrer_reward_auto_enabled',
        'shamo_auto_enabled',
        'shamo_daily_time',
        'shamo_prize_per_button',
        'shamo_total_buttons',
        'shamo_eligibility_deposit_days',
        'shamo_cooldown_hours',
        'shamo_badge_enabled',
        'shamo_eligibility_enabled',    // ← ADD
        'shamo_min_deposit_amount',     // ← ADD
      ]
    }
  });
  const map: Record<string, any> = {};
  for (const doc of docs) {
    map[doc.key] = doc.value;
  }
  settings = {
    botToken: map.bot_token || '',
    botUsername: map.bot_username || '',
    supportUsername: map.support_username || '',
    channelUsername: map.channel_username || '',
    adminIds: map.admin_ids || '',
    etbCoinEnabled: map.etb_coin_enabled === true,
    cbeAccountName: map.cbe_account_name || '',
    cbeAccountNumber: map.cbe_account_number || '',
    cbeInstructionsAmh: map.cbe_instructions_amh || '',
    abyssiniaAccountName: map.abyssinia_account_name || '',
    abyssiniaAccountNumber: map.abyssinia_account_number || '',
    abyssiniaInstructionsAmh: map.abyssinia_instructions_amh || '',
    cbeBirrAccountName: map.cbe_birr_account_name || '',
    cbeBirrPhone: map.cbe_birr_phone || '',
    cbeBirrInstructionsAmh: map.cbe_birr_instructions_amh || '',
    telebirrAccountName: map.telebirr_account_name || '',
    telebirrPhone: map.telebirr_phone || '',
    telebirrInstructionsAmh: map.telebirr_instructions_amh || '',
    depositEnabled: map.deposit_enabled === true,
    withdrawEnabled: map.withdraw_enabled === true,
    backupEnabled: map.backup_enabled === true,
    backupRetentionDays: map.backup_retention_days || 30,
    backupCronTime: map.backup_cron_time || '0 2 * * *',
    googleDriveBackupFolderId: map.google_drive_backup_folder_id || '',
    googleDriveServiceAccountKeyEncrypted: map.google_drive_service_account_key_encrypted || '',
    gamePaused: map.game_paused === true,
    referralEnabled: map.referral_enabled === true,
    referralBonusAmount: map.referral_bonus_amount ?? 10,
    phoneBonusEnabled: map.phone_bonus_enabled === true,
    phoneBonusAmount: map.phone_bonus_amount ?? 10,
    agentSystemEnabled: map.agent_system_enabled === true,
    agentCommissionPercent: map.agent_commission_percent ?? 5,
    agentFirstDepositBonusEnabled: map.agent_first_deposit_bonus_enabled === true,
    agentFirstDepositBonusHigh: map.agent_first_deposit_bonus_high ?? 10,
    agentFirstDepositBonusLow: map.agent_first_deposit_bonus_low ?? 5,
    agentMinDepositForBonusHigh: map.agent_min_deposit_for_bonus_high ?? 50,
    agentMinDepositForBonusLow: map.agent_min_deposit_for_bonus_low ?? 20,
    botNames: map.bot_names || '',
    botCountMin: map.bot_count_min ?? 14,
    botCountMax: map.bot_count_max ?? 20,
    botsEnabled: map.bots_enabled !== false,
    botModeEnabled: map.bot_mode_enabled === true,
    botModeRigSeed: map.bot_mode_rig_seed || 'default_seed',
    depositBonusEnabled: map.deposit_bonus_enabled === true,
    depositBonusPercent: map.deposit_bonus_percent ?? 0,
    
    depositorRewardEnabled: map.depositor_reward_enabled === true,
    depositorRewardTopCount: map.depositor_reward_top_count ?? 10,
    depositorRewardRules: Array.isArray(map.depositor_reward_rules) ? map.depositor_reward_rules : [
      { from: 1, to: 1, amount: 100 },
      { from: 2, to: 3, amount: 50 },
      { from: 4, to: 10, amount: 20 },
    ],
    depositorRewardAutoEnabled: map.depositor_reward_auto_enabled === true,
    referrerRewardEnabled: map.referrer_reward_enabled === true,
    referrerRewardTopCount: map.referrer_reward_top_count ?? 5,
    referrerRewardRules: Array.isArray(map.referrer_reward_rules) ? map.referrer_reward_rules : [
      { from: 1, to: 1, amount: 100 },
      { from: 2, to: 3, amount: 50 },
      { from: 4, to: 5, amount: 20 },
    ],
    referrerRewardAutoEnabled: map.referrer_reward_auto_enabled === true,
    // ── Shamo Giveaway — ?? for numeric defaults, string guarded explicitly ──
    shamoAutoEnabled: map.shamo_auto_enabled === true,
    shamoDailyTime:
      typeof map.shamo_daily_time === 'string' && /^\d{2}:\d{2}$/.test(map.shamo_daily_time)
        ? map.shamo_daily_time
        : '21:00',
    shamoPrizePerButton: map.shamo_prize_per_button ?? 50,
    shamoTotalButtons: map.shamo_total_buttons ?? 50,
    shamoEligibilityDepositDays: map.shamo_eligibility_deposit_days ?? 7,
    shamoCooldownHours: map.shamo_cooldown_hours ?? 24,
    shamoBadgeEnabled: map.shamo_badge_enabled !== false,
    shamoEligibilityEnabled: map.shamo_eligibility_enabled !== false,   // default true
shamoMinDepositAmount: Number(map.shamo_min_deposit_amount) || 0,
  };
}

export function getSettings(): AppSettings {
  if (!settings) {
    throw new Error('Settings not loaded');
  }
  return settings;
}