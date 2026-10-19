//src/bot/messages/templates.ts
export class MessageTemplates {
  
  // Welcome messages
  static welcomeNewUser(firstName: string, referralCode: string): string {
    return `🎉 *Welcome to ethio_bingoobot, ${firstName}!*\n\n` +
      `I'm your automated account registration assistant.\n\n` +
      `📋 *How it works:*\n` +
      `1. Get account details from me\n` +
      `2. Register on target site\n` +
      `3. Submit completion\n` +
      `4. Get paid after 1 hours\n\n` +
      `🤑 *Earnings:*\n` +
      `• Per account: $0.16\n` +
      `• Commission: 20%\n` +
      `• Min withdrawal: $0.50\n\n` +
      `👥 *Referral Program:*\n` +
      `Share your code and earn 10% of referrals' earnings!\n` +
      `Your code: \`${referralCode}\`\n\n` +
      `🔷 *Ready to start?* Use /register or click the button below!`;
  }
  
  static welcomeBackUser(firstName: string, balance: number): string {
    return `👋 *Welcome back, ${firstName}!*\n\n` +
      `Your current balance: *$${balance.toFixed(2)}*\n\n` +
      `Ready to earn more? Use /register to get a new account!`;
  }
  

  
  // System messages
  static systemMaintenance(duration: string): string {
    return `🔧 *System Maintenance*\n\n` +
      `The system is undergoing maintenance.\n` +
      `Expected duration: ${duration}\n\n` +
      `All pending jobs will be processed after maintenance.\n` +
      `Thank you for your patience!`;
  }
  
  static systemUpdate(version: string, changes: string[]): string {
    let changesText = '';
    changes.forEach((change, index) => {
      changesText += `${index + 1}. ${change}\n`;
    });
    
    return `🔄 *System Update*\n\n` +
      `Version: ${version}\n\n` +
      `📋 *Changes:*\n${changesText}\n` +
      `All systems are now operational.`;
  }
  
  // Notification messages
  static dailySummary(stats: DailySummaryStats): string {
    return `📊 *Daily Summary*\n\n` +
      `📅 Date: ${stats.date}\n` +
      `🤑 Today's Earnings: *$${stats.todayEarnings.toFixed(2)}*\n` +
      `📈 Total Balance: *$${stats.totalBalance.toFixed(2)}*\n` +
      `✅ Jobs Completed: ${stats.jobsCompleted}\n` +
      `🎯 Success Rate: ${stats.successRate.toFixed(1)}%\n\n` +
      `Keep up the great work! 🔷`;
  }
  
  static referralEarned(referralName: string, amount: number, level: number): string {
    return `👥 *Referral Earnings!*\n\n` +
      `User: ${referralName}\n` +
      `Level: ${level}\n` +
      `Amount: *$${amount.toFixed(2)}*\n\n` +
      `You earned commission from your referral's activity!`;
  }
  
  // Error messages
  static errorGeneric(): string {
    return `❌ *Something went wrong!*\n\n` +
      `Please try again or contact support if the problem persists.`;
  }
  
  static errorRateLimit(waitTime: string): string {
    return `⏳ *Rate Limit Exceeded*\n\n` +
      `Please wait ${waitTime} before trying again.\n` +
      `This helps prevent abuse and ensures system stability.`;
  }
  
  static errorInsufficientBalance(required: number, available: number): string {
    return `❌ *Insufficient Balance*\n\n` +
      `Required: *$${required.toFixed(2)}*\n` +
      `Available: *$${available.toFixed(2)}*\n\n` +
      `Please complete more jobs to increase your balance.`;
  }
  
  // Success messages
  static successGeneric(action: string): string {
    return `✅ *${action} Successful!*`;
  }
  
  static successSettingsUpdated(setting: string, value: string): string {
    return `✅ *Setting Updated*\n\n` +
      `${setting}: *${value}*\n\n` +
      `Your preference has been saved.`;
  }
  
  // Information messages
  static infoComingSoon(): string {
    return `🚧 *Coming Soon!*\n\n` +
      `This feature is under development.\n` +
      `Stay tuned for updates!`;
  }
  
  static infoUnderMaintenance(): string {
    return `🔧 *Under Maintenance*\n\n` +
      `This feature is currently being improved.\n` +
      `Check back soon!`;
  }
}



export interface DailySummaryStats {
  date: string;
  todayEarnings: number;
  totalBalance: number;
  jobsCompleted: number;
  successRate: number;
}