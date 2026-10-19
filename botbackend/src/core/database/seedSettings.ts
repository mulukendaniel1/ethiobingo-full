//src\core\database\seedSettings.ts
import { SystemSettings } from './models/SystemSettings';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import bcrypt from 'bcryptjs';

export const BOT_SETTINGS_KEYS = [
  'bot_token',
  'bot_username',
  'support_username',
  'channel_username',
  'admin_ids',
  'etb_coin_enabled',
  'settings_access_password',
  'deposit_enabled',
  'withdraw_enabled',
  'backup_enabled',
  'backup_retention_days',
  'backup_cron_time',
  'google_drive_backup_folder_id',
  'google_drive_service_account_key_encrypted',
  'game_paused',
  'referral_enabled',                    // ✅ ADD THIS
  'referral_bonus_amount',               // already there? ensure it's included
  'phone_bonus_enabled',                 // ✅ ADD THIS
  'phone_bonus_amount',                  // ✅ ADD THIS
  'agent_system_enabled',                // ✅ ADD THIS (if not already)
  'agent_commission_percent',
  'agent_first_deposit_bonus_enabled',
  'agent_first_deposit_bonus_high',
  'agent_first_deposit_bonus_low',
  'agent_min_deposit_for_bonus_high',    // ✅ ADD THIS
  'agent_min_deposit_for_bonus_low',     // ✅ ADD THIS
  'bot_names',
  'bot_count_min',
  'bot_count_max',
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
  'shamo_eligibility_enabled',
'shamo_min_deposit_amount',
];

export const DEPOSIT_SETTINGS_KEYS = [
  'cbe_account_name',
  'cbe_account_number',
  'cbe_instructions_amh',
  'abyssinia_account_name',
  'abyssinia_account_number',
  'abyssinia_instructions_amh',
  'cbe_birr_account_name',
  'cbe_birr_phone',
  'cbe_birr_instructions_amh',
  'telebirr_account_name',
  'telebirr_phone',
  'telebirr_instructions_amh'
];

export const ALL_SETTINGS_KEYS = [...BOT_SETTINGS_KEYS, ...DEPOSIT_SETTINGS_KEYS];

export async function seedSettings(): Promise<void> {
  // Default plain password for settings access
  const defaultSettingsPassword = process.env.SETTINGS_ACCESS_PASSWORD || 'ethio1221';
  const hashedSettingsPassword = await bcrypt.hash(defaultSettingsPassword, 10);

  const defaults: Record<string, any> = {
    bot_token: env.BOT_TOKEN,
    bot_username: env.BOT_USERNAME || 'ethio_bingoobot',
    support_username: env.SUPPORT_USERNAME || '@Ethiobingosupport2',
    channel_username: env.CHANNEL_USERNAME || '@ethio_bingo7',
    admin_ids: env.ADMIN_IDS || '798273370,1452483898',
    etb_coin_enabled: env.ETB_COIN_ENABLED,
    settings_access_password: hashedSettingsPassword, // <-- hashed
    cbe_account_name: env.CBE_ACCOUNT_NAME || 'Your Name',
    cbe_account_number: env.CBE_ACCOUNT_NUMBER || '1000*********',
    cbe_instructions_amh: env.CBE_INSTRUCTIONS_AMH || 'ወደሚከተለው የንግድ ባንክ አካውንት ገንዘብ ያስገቡ እና የዝውውር መለያዎን ማለትም TRANSACTION ID ያስገቡ።',
    abyssinia_account_name: env.ABYSSINIA_ACCOUNT_NAME || 'Your Name',
    abyssinia_account_number: env.ABYSSINIA_ACCOUNT_NUMBER || '7********',
    abyssinia_instructions_amh: env.ABYSSINIA_INSTRUCTIONS_AMH || 'ወደሚከተለው የአቢሲንያ ባንክ አካውንት ገንዘብ ያስገቡ እና የዝውውር መለያዎን ማለትም TRANSACTION ID ያስገቡ።',
    cbe_birr_account_name: env.CBE_BIRR_ACCOUNT_NAME || 'Your Name',
    cbe_birr_phone: env.CBE_BIRR_PHONE || '09********',
    cbe_birr_instructions_amh: env.CBE_BIRR_INSTRUCTIONS_AMH || 'ወደሚከተለው የሲቢኢ ብር ስልክ ቁጥር ገንዘብ ያስገቡ እና የዝውውር መለያዎን ማለትም TRANSACTION ID ያስገቡ።',
    telebirr_account_name: env.TELEBIRR_ACCOUNT_NAME || 'Your Name',
    telebirr_phone: env.TELEBIRR_PHONE || '09********',
    telebirr_instructions_amh: env.TELEBIRR_INSTRUCTIONS_AMH || 'ወደሚከተለው የቴሌቢር ስልክ ቁጥር ገንዘብ ያስገቡ እና የዝውውር መለያዎን ማለትም TRANSACTION ID ያስገቡ።',
    deposit_enabled: true,
    withdraw_enabled: true,
    backup_enabled: true,
    backup_retention_days: 30,
    backup_cron_time: '0 2 * * *',  // 2 AM UTC daily
    google_drive_backup_folder_id: '',
    google_drive_service_account_key_encrypted: '',
    game_paused: false,
    phone_bonus_enabled: true,
    phone_bonus_amount: 10,
    agent_first_deposit_bonus_enabled: true,
    agent_first_deposit_bonus_high: 10,
    agent_first_deposit_bonus_low: 5,
    agent_commission_percent: 5,
    agent_min_deposit_for_bonus_high: 50,
    agent_min_deposit_for_bonus_low: 20,
    referral_bonus_amount: 10,
    referral_enabled: true,
    bot_names: 'alamin\nmuhe\nderje\nadisu\nmisker\nhaylu\ndani\nfani\nseya\ndejne\neskndr\ngemchu\nahimed\naferem\ntades\ngeremew\ntesfaye\nAbdi\nSofi',
    bot_count_min: 14,
    bot_count_max: 20,
    bots_enabled: true, 
    bot_mode_enabled: false,
    bot_mode_rig_seed: 'default_seed',
    deposit_bonus_enabled: false,
    deposit_bonus_percent: 0,
        depositor_reward_enabled: true,
    depositor_reward_top_count: 10,
    depositor_reward_rules: [
      { from: 1, to: 1, amount: 100 },
      { from: 2, to: 3, amount: 50 },
      { from: 4, to: 10, amount: 20 },
    ],
    depositor_reward_auto_enabled: false,
    referrer_reward_enabled: true,
    referrer_reward_top_count: 5,
    referrer_reward_rules: [
      { from: 1, to: 1, amount: 100 },
      { from: 2, to: 3, amount: 50 },
      { from: 4, to: 5, amount: 20 },
    ],
    referrer_reward_auto_enabled: false,
    shamo_auto_enabled: false,
    shamo_daily_time: '21:00',         // Ethiopian local time (UTC+3)
    shamo_prize_per_button: 50,
    shamo_total_buttons: 50,
    shamo_eligibility_deposit_days: 7,
    shamo_cooldown_hours: 24,
    shamo_badge_enabled: true,
    shamo_eligibility_enabled: true,     // true = check; false = anyone can claim
shamo_min_deposit_amount: 0,         // 0 = any deposit counts (current behavior)
  };

  for (const key of ALL_SETTINGS_KEYS) {
    await SystemSettings.findOneAndUpdate(
      { key },
      { $setOnInsert: { value: defaults[key] } },
      { upsert: true, new: true }
    );
  }
  logger.info('✅ System settings seeded');
}