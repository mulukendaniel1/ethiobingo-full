//src/core/types/telegram.ts
// Telegram Bot API Types
export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  added_to_attachment_menu?: boolean;
  can_join_groups?: boolean;
  can_read_all_group_messages?: boolean;
  supports_inline_queries?: boolean;
}

export interface TelegramChat {
  id: number;
  type: 'private' | 'group' | 'supergroup' | 'channel';
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  photo?: TelegramChatPhoto;
  bio?: string;
  has_private_forwards?: boolean;
  description?: string;
  invite_link?: string;
  pinned_message?: TelegramMessage;
  permissions?: TelegramChatPermissions;
  slow_mode_delay?: number;
  message_auto_delete_time?: number;
  has_protected_content?: boolean;
  sticker_set_name?: string;
  can_set_sticker_set?: boolean;
  linked_chat_id?: number;
  location?: TelegramChatLocation;
}

export interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  sender_chat?: TelegramChat;
  date: number;
  chat: TelegramChat;
  forward_from?: TelegramUser;
  forward_from_chat?: TelegramChat;
  forward_from_message_id?: number;
  forward_signature?: string;
  forward_sender_name?: string;
  forward_date?: number;
  is_automatic_forward?: boolean;
  reply_to_message?: TelegramMessage;
  via_bot?: TelegramUser;
  edit_date?: number;
  has_protected_content?: boolean;
  media_group_id?: string;
  author_signature?: string;
  text?: string;
  entities?: TelegramMessageEntity[];
  animation?: TelegramAnimation;
  audio?: TelegramAudio;
  document?: TelegramDocument;
  photo?: TelegramPhotoSize[];
  sticker?: TelegramSticker;
  video?: TelegramVideo;
  video_note?: TelegramVideoNote;
  voice?: TelegramVoice;
  caption?: string;
  caption_entities?: TelegramMessageEntity[];
  contact?: TelegramContact;
  dice?: TelegramDice;
  game?: TelegramGame;
  poll?: TelegramPoll;
  venue?: TelegramVenue;
  location?: TelegramLocation;
  new_chat_members?: TelegramUser[];
  left_chat_member?: TelegramUser;
  new_chat_title?: string;
  new_chat_photo?: TelegramPhotoSize[];
  delete_chat_photo?: boolean;
  group_chat_created?: boolean;
  supergroup_chat_created?: boolean;
  channel_chat_created?: boolean;
  message_auto_delete_timer_changed?: TelegramMessageAutoDeleteTimerChanged;
  migrate_to_chat_id?: number;
  migrate_from_chat_id?: number;
  pinned_message?: TelegramMessage;
  invoice?: TelegramInvoice;
  successful_payment?: TelegramSuccessfulPayment;
  connected_website?: string;
  passport_data?: TelegramPassportData;
  proximity_alert_triggered?: TelegramProximityAlertTriggered;
  forum_topic_created?: TelegramForumTopicCreated;
  forum_topic_edited?: TelegramForumTopicEdited;
  forum_topic_closed?: TelegramForumTopicClosed;
  forum_topic_reopened?: TelegramForumTopicReopened;
  video_chat_scheduled?: TelegramVideoChatScheduled;
  video_chat_started?: TelegramVideoChatStarted;
  video_chat_ended?: TelegramVideoChatEnded;
  video_chat_participants_invited?: TelegramVideoChatParticipantsInvited;
  web_app_data?: TelegramWebAppData;
  reply_markup?: TelegramInlineKeyboardMarkup;
}

export interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  inline_message_id?: string;
  chat_instance: string;
  data?: string;
  game_short_name?: string;
}

export interface TelegramInlineKeyboardMarkup {
  inline_keyboard: TelegramInlineKeyboardButton[][];
}

export interface TelegramInlineKeyboardButton {
  text: string;
  url?: string;
  callback_data?: string;
  web_app?: TelegramWebAppInfo;
  login_url?: TelegramLoginUrl;
  switch_inline_query?: string;
  switch_inline_query_current_chat?: string;
  callback_game?: TelegramCallbackGame;
  pay?: boolean;
}

// MTProto Specific Types
export interface MTProtoSession {
  id: string;
  userId: number;
  sessionString: string;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
  isValid: boolean;
}

export interface MTProtoAccount {
  id: string;
  phoneNumber: string;
  apiId: number;
  apiHash: string;
  sessionString?: string;
  isActive: boolean;
  lastUsed: Date;
  usageCount: number;
  isMaster: boolean;
  metadata?: Record<string, any>;
}

export interface MTProtoMessage {
  id: number;
  peerId: string;
  fromId?: string;
  message: string;
  date: number;
  out: boolean;
  mentioned: boolean;
  mediaUnread: boolean;
  silent: boolean;
  post: boolean;
  fromScheduled: boolean;
  legacy: boolean;
  editHide: boolean;
  pinned: boolean;
  fromBot: boolean;
  viaBotId?: string;
  replyTo?: any;
  media?: any;
  replyMarkup?: any;
  entities?: any[];
  views?: number;
  forwards?: number;
  replies?: any;
  editDate?: number;
  postAuthor?: string;
  groupedId?: string;
  restrictionReason?: any[];
  ttlPeriod?: number;
}

export interface MTProtoCallback {
  id: string;
  data: string;
  messageId: number;
  userId: number;
  timestamp: Date;
  processed: boolean;
  response?: any;
}

// Bot Context Types
export interface BotContextState {
  user?: any;
  session: {
    step: string;
    data: any;
    timestamp: Date;
  };
  job?: any;
  conversation?: any;
}

export interface BotMiddlewareContext {
  state: BotContextState;
  from?: TelegramUser;
  chat?: TelegramChat;
  message?: TelegramMessage;
  callbackQuery?: TelegramCallbackQuery;
  me?: TelegramUser;
  match?: RegExpMatchArray;
  reply: (text: string, options?: any) => Promise<TelegramMessage>;
  editMessageText: (text: string, options?: any) => Promise<boolean>;
  answerCallbackQuery: (options?: any) => Promise<boolean>;
  deleteMessage: () => Promise<boolean>;
  api: any;
}

// Helper Types
export interface TelegramChatPhoto {
  small_file_id: string;
  small_file_unique_id: string;
  big_file_id: string;
  big_file_unique_id: string;
}

export interface TelegramChatPermissions {
  can_send_messages?: boolean;
  can_send_media_messages?: boolean;
  can_send_polls?: boolean;
  can_send_other_messages?: boolean;
  can_add_web_page_previews?: boolean;
  can_change_info?: boolean;
  can_invite_users?: boolean;
  can_pin_messages?: boolean;
  can_manage_topics?: boolean;
}

export interface TelegramChatLocation {
  location: TelegramLocation;
  address: string;
}

export interface TelegramMessageEntity {
  type: string;
  offset: number;
  length: number;
  url?: string;
  user?: TelegramUser;
  language?: string;
  custom_emoji_id?: string;
}

export interface TelegramPhotoSize {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  file_size?: number;
}

export interface TelegramAnimation {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  duration: number;
  thumb?: TelegramPhotoSize;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
}

export interface TelegramAudio {
  file_id: string;
  file_unique_id: string;
  duration: number;
  performer?: string;
  title?: string;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
  thumb?: TelegramPhotoSize;
}

export interface TelegramDocument {
  file_id: string;
  file_unique_id: string;
  thumb?: TelegramPhotoSize;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
}

export interface TelegramSticker {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  is_animated: boolean;
  is_video: boolean;
  thumb?: TelegramPhotoSize;
  emoji?: string;
  set_name?: string;
  premium_animation?: TelegramFile;
  mask_position?: TelegramMaskPosition;
  custom_emoji_id?: string;
  file_size?: number;
}

export interface TelegramVideo {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  duration: number;
  thumb?: TelegramPhotoSize;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
}

export interface TelegramVideoNote {
  file_id: string;
  file_unique_id: string;
  length: number;
  duration: number;
  thumb?: TelegramPhotoSize;
  file_size?: number;
}

export interface TelegramVoice {
  file_id: string;
  file_unique_id: string;
  duration: number;
  mime_type?: string;
  file_size?: number;
}

export interface TelegramContact {
  phone_number: string;
  first_name: string;
  last_name?: string;
  user_id?: number;
  vcard?: string;
}

export interface TelegramDice {
  emoji: string;
  value: number;
}

export interface TelegramGame {
  title: string;
  description: string;
  photo: TelegramPhotoSize[];
  text?: string;
  text_entities?: TelegramMessageEntity[];
  animation?: TelegramAnimation;
}

export interface TelegramPoll {
  id: string;
  question: string;
  options: TelegramPollOption[];
  total_voter_count: number;
  is_closed: boolean;
  is_anonymous: boolean;
  type: string;
  allows_multiple_answers: boolean;
  correct_option_id?: number;
  explanation?: string;
  explanation_entities?: TelegramMessageEntity[];
  open_period?: number;
  close_date?: number;
}

export interface TelegramPollOption {
  text: string;
  voter_count: number;
}

export interface TelegramVenue {
  location: TelegramLocation;
  title: string;
  address: string;
  foursquare_id?: string;
  foursquare_type?: string;
  google_place_id?: string;
  google_place_type?: string;
}

export interface TelegramLocation {
  longitude: number;
  latitude: number;
  horizontal_accuracy?: number;
  live_period?: number;
  heading?: number;
  proximity_alert_radius?: number;
}

export interface TelegramMessageAutoDeleteTimerChanged {
  message_auto_delete_time: number;
}

export interface TelegramInvoice {
  title: string;
  description: string;
  start_parameter: string;
  currency: string;
  total_amount: number;
}

export interface TelegramSuccessfulPayment {
  currency: string;
  total_amount: number;
  invoice_payload: string;
  shipping_option_id?: string;
  order_info?: TelegramOrderInfo;
  telegram_payment_charge_id: string;
  provider_payment_charge_id: string;
}

export interface TelegramOrderInfo {
  name?: string;
  phone_number?: string;
  email?: string;
  shipping_address?: TelegramShippingAddress;
}

export interface TelegramShippingAddress {
  country_code: string;
  state: string;
  city: string;
  street_line1: string;
  street_line2: string;
  post_code: string;
}

export interface TelegramPassportData {
  data: TelegramEncryptedPassportElement[];
  credentials: TelegramEncryptedCredentials;
}

export interface TelegramEncryptedPassportElement {
  type: string;
  data?: string;
  phone_number?: string;
  email?: string;
  files?: TelegramPassportFile[];
  front_side?: TelegramPassportFile;
  reverse_side?: TelegramPassportFile;
  selfie?: TelegramPassportFile;
  translation?: TelegramPassportFile[];
  hash: string;
}

export interface TelegramPassportFile {
  file_id: string;
  file_unique_id: string;
  file_size: number;
  file_date: number;
}

export interface TelegramEncryptedCredentials {
  data: string;
  hash: string;
  secret: string;
}

export interface TelegramProximityAlertTriggered {
  traveler: TelegramUser;
  watcher: TelegramUser;
  distance: number;
}

export interface TelegramForumTopicCreated {
  name: string;
  icon_color: number;
  icon_custom_emoji_id?: string;
}

export interface TelegramForumTopicEdited {
  name?: string;
  icon_custom_emoji_id?: string;
}

export interface TelegramForumTopicClosed {}

export interface TelegramForumTopicReopened {}

export interface TelegramVideoChatScheduled {
  start_date: number;
}

export interface TelegramVideoChatStarted {}

export interface TelegramVideoChatEnded {
  duration: number;
}

export interface TelegramVideoChatParticipantsInvited {
  users: TelegramUser[];
}

export interface TelegramWebAppData {
  data: string;
  button_text: string;
}

export interface TelegramWebAppInfo {
  url: string;
}

export interface TelegramLoginUrl {
  url: string;
  forward_text?: string;
  bot_username?: string;
  request_write_access?: boolean;
}

export interface TelegramCallbackGame {}

export interface TelegramMaskPosition {
  point: string;
  x_shift: number;
  y_shift: number;
  scale: number;
}

export interface TelegramFile {
  file_id: string;
  file_unique_id: string;
  file_size?: number;
  file_path?: string;
}