//src\core\database\models\User.ts
import mongoose, { Schema, model, Document, Model } from 'mongoose';
import { CryptoUtils } from '../../utils/crypto';
import { sanitizeInput } from '../../utils/security';
export interface ReferralEntry {
  userId: mongoose.Types.ObjectId;
  level: number;
  joinedAt: Date;
  firstDepositBonusGiven?: boolean; // optional, defaults to false in schema
  referralSignupBonusGiven?: boolean;
}

export interface CommissionEntry {
  jobId: string;
  fromUserId: mongoose.Types.ObjectId;
  amount: number;
  level: number;
  createdAt: Date;
}

// Interface for balance holds tracking
export interface BalanceHold {
  jobId: string;
  amount: number;
  createdAt: Date;
  _id?: mongoose.Types.ObjectId;
}

export type ETBTransaction = {
  type: 'earned' | 'redeemed' | 'transferred';
  amount: number;
  taskId?: string;
  reference: string;
  notes?: string;
  timestamp: Date;
  _id?: mongoose.Types.ObjectId;
};

export interface IUser extends Document {
  telegramId: number;
  username?: string;
  firstName: string;
  lastName?: string;
  balanceMain: number;// withdrawable
  balanceHold: number;
  totalEarned: number;
  totalWithdrawn: number;
  
  // Balance holds tracking
  balanceHolds?: BalanceHold[];
  
  // Security & Settings
  isBanned: boolean;
  banReason?: string;
  isAdmin: boolean;
  isAgent: boolean;
  agentApprovedAt?: Date;

  email?: string;          // only for admin accounts
  password?: string;       // hashed password

  referralCode: string;
  referredBy?: mongoose.Types.ObjectId;
  referralCount: number;
  referralEarnings: number;
  
  // Limits & Statistics
  lastLoginAt: Date;

  // Session Management
  sessionToken?: string;
  sessionExpiresAt?: Date;
  ipAddresses?: string[];
  devices?: string[];
  sessionId?: string | null; // allow null

 
  // Referral System
  referrals: ReferralEntry[];
  
  //language 
  language: 'en' | 'am' | 'ti' | 'om' | 'so';
  
  //telegrm shared phone number 
  phoneNumber?: string;
  // ETB System
  ETBCoins: number; // total = balanceMain + lockedBalance
  totalETBEarned: number;
  lockedETB: number;
  lockedWithdrawAmount: number;  // ETB locked for pending withdrawals
  totalETBRedeemed: number;
  ETBCoinTransactions: ETBTransaction[];
  lockedBalance: number;        // ETB that are not yet withdrawable (from deposits + bonuses combined)

  totalCommissionPaid:number;

  // ── Bonus-abuse guard ──────────────────────────────────────────────
  // isAbuser: when true, withdrawals are blocked until the user proves
  // genuine deposit activity (see withdrawal routes for the check).
  isAbuser: boolean;
  // Lifetime total of confirmed deposits (never decreases).
  totalConfirmedDepositsETB: number;
  // Sub-balances of lockedBalance, split by origin so we can tell whether
  // a given purchase drew on deposit money or bonus money.
  // depositBalance + bonusBalance should always equal lockedBalance.
  depositBalance: number;
  bonusBalance: number;
  // Tracks the user's very first bet, to resolve rules 2 / 2b / 5.
  hasPlacedFirstBet: boolean;
  firstBetRoundId?: string;
  firstBetFundedByDeposit?: boolean;
  // True forever, the first time ANY purchase (not just the first bet)
  // draws on real deposit money. Lets a later deposit retroactively
  // clear isAbuser even if the first bet happened to be bonus-funded.
  hasWageredFromDeposit: boolean;
  hasCompletedDepositWager: boolean;

  // Subscription tracking - ADD THESE
  isSubscribed: boolean;
  lastSubscriptionCheck?: Date;
  subscriptionHistory?: Array<{
    timestamp: Date;
    status: 'subscribed' | 'unsubscribed';
  }>;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
  
  // Instance methods
  canAcceptJob(): Promise<{ allowed: boolean; reason?: string }>;
  updateLastJob(): Promise<IUser>;
  addBalance(amount: number, type?: 'main' | 'hold', metadata?: any): Promise<IUser>;
  resetDailyLimitIfNeeded(): Promise<IUser>;
  
  // Methods
  addETBCoins(amount: number, type: 'earned' | 'redeemed' | 'transferred', taskId?: string, reference?: string, notes?: string): Promise<IUser>;
}

// Static methods interface
interface UserModel extends Model<IUser> {
  findByTelegramId(telegramId: number): Promise<IUser | null>;
  findByReferralCode(referralCode: string): Promise<IUser | null>;
}

const UserSchema = new Schema<IUser, UserModel>({
  telegramId: { type: Number, required: true, unique: true, index: true },
  username: { type: String, index: true },
  firstName: { type: String, required: true },
  lastName: String,
  
  // Balances
  balanceMain: { type: Number, default: 0, min: 0 },
  balanceHold: { type: Number, default: 0, min: 0 },
  totalEarned: { type: Number, default: 0, min: 0 },
  totalWithdrawn: { type: Number, default: 0, min: 0 },
  lockedBalance: { type: Number, default: 0, min: 0 },
  
  // Balance holds tracking
  balanceHolds: {
    type: [{
      jobId: { type: String, required: true },
      amount: { type: Number, required: true, min: 0 },
      createdAt: { type: Date, default: Date.now }
    }],
    default: undefined
  },
  
  // Security
  isBanned: { type: Boolean, default: false },
  banReason: String,
  isAdmin: { type: Boolean, default: false },
  email: { type: String, sparse: true, unique: true },
  password: { type: String },

  isAgent: { type: Boolean, default: false },
  agentApprovedAt: { type: Date },
  
  // Referral System (Enhanced)
  referralCode: { 
    type: String, 
    required: true, 
    unique: true,
    default: () => CryptoUtils.generateReferralCode()
  },
  referredBy: { type: Schema.Types.ObjectId, ref: 'User' },
  referralCount: { type: Number, default: 0 },
  referralEarnings: { type: Number, default: 0 },
  
  // Referral tracking
  referrals: [{
  userId: { type: Schema.Types.ObjectId, ref: 'User' },
  level: { type: Number, default: 1 },
  joinedAt: { type: Date, default: Date.now },
  firstDepositBonusGiven: { type: Boolean, default: false },
  referralSignupBonusGiven: { type: Boolean, default: false }
}],
  
  // ETB Coin System
  ETBCoins: { 
    type: Number, 
    default: 0, 
    min: 0 
  },
  totalETBEarned: { 
    type: Number, 
    default: 0, 
    min: 0 
  },
  totalETBRedeemed: { 
    type: Number, 
    default: 0, 
    min: 0 
  },
  
  ETBCoinTransactions: {
  type: [{
    type: { 
      type: String, 
      enum: ['earned', 'redeemed', 'transferred'] as const 
    },
    amount: { 
      type: Number, 
      required: true 
    },
    taskId: String,
    reference: { 
      type: String, 
      required: true 
    },
    notes: String,
    timestamp: { 
      type: Date, 
      default: Date.now 
    }
  }],
  default: []
},

  lockedETB: { type: Number, default: 0, min: 0 },
  lockedWithdrawAmount: { type: Number, default: 0, min: 0 },

  totalCommissionPaid: { type: Number, default: 0 },

  // ── Bonus-abuse guard fields ─────────────────────────────────────
  isAbuser: { type: Boolean, default: false },
  totalConfirmedDepositsETB: { type: Number, default: 0, min: 0 },
  depositBalance: { type: Number, default: 0, min: 0 },
  bonusBalance: { type: Number, default: 0, min: 0 },
  hasPlacedFirstBet: { type: Boolean, default: false },
  firstBetRoundId: { type: String, default: null },
  firstBetFundedByDeposit: { type: Boolean, default: false },
  hasWageredFromDeposit: { type: Boolean, default: false },
  hasCompletedDepositWager: { type: Boolean, default: false },

  lastLoginAt: { type: Date, default: Date.now },
  
  // Session
  sessionToken: { type: String },
  sessionExpiresAt: { type: Date },
  ipAddresses: { type: [String] },
  devices: { type: [String] },
  sessionId: { type: String, default: null },
  
   isSubscribed: {
    type: Boolean,
    default: false,
    required: true
  },
  
  lastSubscriptionCheck: {
    type: Date,
    default: null
  },

  language: {
    type: String,
    enum: ['en', 'am', 'ti', 'om', 'so'],
    default: 'en',
    required: true
  },
  
  phoneNumber: { type: String, default: null },
  
  subscriptionHistory: [{
    timestamp: { type: Date, default: Date.now },
    status: { type: String, enum: ['subscribed', 'unsubscribed'] }
  }]

}, {
  timestamps: true
});

// Indexes
UserSchema.index({ isBanned: 1, dailyLimit: 1 });
UserSchema.index({ createdAt: 1 });
UserSchema.index({ totalEarned: -1 });
UserSchema.index({ isAgent: 1, bonusBalance: 1 });
UserSchema.index({ lastLoginAt: -1 });
UserSchema.index(
  { phoneNumber: 1 },
  { unique: true, partialFilterExpression: { phoneNumber: { $type: 'string' } }, name: 'phoneNumber_unique' }
);

// Static methods implementation
UserSchema.statics.findByTelegramId = function(telegramId: number) {
  const safeTelegramId = parseInt(sanitizeInput(telegramId.toString()));
  return this.findOne({ telegramId: safeTelegramId });
};

UserSchema.statics.findByReferralCode = function(referralCode: string) {
  const safeReferralCode = sanitizeInput(referralCode);
  return this.findOne({ referralCode: safeReferralCode });
};

UserSchema.methods.addBalance = async function(this: IUser, amount: number, type: 'main' | 'hold' = 'main', metadata?: any): Promise<IUser> {
  if (amount == null || isNaN(amount) || !isFinite(amount)) {
    throw new Error(`Invalid amount: ${amount}`);
  }
  if (type === 'main') this.balanceMain += amount;
  else this.balanceHold += amount;
  if (amount > 0) this.totalEarned += amount;
  if (type === 'hold' && metadata?.jobId && amount > 0) {
    const safeJobId = sanitizeInput(metadata.jobId);
    if (!this.balanceHolds) this.balanceHolds = [];
    this.balanceHolds.push({ jobId: safeJobId, amount, createdAt: new Date() });
  }
  return this.save();
};

UserSchema.methods.addETBCoins = async function(
  amount: number,
  type: ETBTransaction['type'] = 'earned',
  taskId?: string,
  reference?: string,
  notes?: string
): Promise<IUser> {
  if (amount <= 0) throw new Error('Amount must be positive');
  const user = this as IUser;
  const safeTaskId = taskId ? sanitizeInput(taskId) : undefined;
  const safeReference = reference ? sanitizeInput(reference) : `ETB-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
  const safeNotes = notes ? sanitizeInput(notes) : undefined;

  if (type === 'redeemed' || type === 'transferred') {
    if (user.ETBCoins < amount) throw new Error(`Insufficient ETB. Available: ${user.ETBCoins}, Required: ${amount}`);
    user.ETBCoins -= amount;
    user.totalETBRedeemed += amount;
  } else {
    user.ETBCoins += amount;
    user.totalETBEarned += amount;
  }

  user.ETBCoinTransactions.push({
    type,
    amount,
    taskId: safeTaskId,
    reference: safeReference,
    notes: safeNotes,
    timestamp: new Date()
  });

  if (user.ETBCoinTransactions.length > 100) {
    user.ETBCoinTransactions = user.ETBCoinTransactions.slice(-100);
  }
  return user.save();
};

// Transformation logic
const transformData = (ret: any) => {
  const result = { ...ret };
  delete result.sessionToken;
  delete result.sessionExpiresAt;
  delete result.ipAddresses;
  delete result.devices;
  return result;
};

UserSchema.set('toJSON', {
  transform: (doc, ret) => {
    const result = transformData(ret);
    if (result.balanceHolds === undefined && process.env.NODE_ENV === 'test') {
      result.balanceHolds = [];
    }
    return result;
  },
  virtuals: true
});

UserSchema.set('toObject', {
  transform: (doc, ret) => {
    const result = transformData(ret);
    if (!result.balanceHolds) result.balanceHolds = [];
    return result;
  },
  virtuals: true
});

export const User = model<IUser, UserModel>('User', UserSchema);