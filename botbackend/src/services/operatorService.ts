//src\services\operatorService.ts
import { Operator } from '../core/database/models/Operator';
import { logger } from '../core/utils/logger';
import { auditService } from './auditService';
import mongoose from 'mongoose';

export class OperatorService {
  private static instance: OperatorService;
  private operatorId = 'ethio_bingoobot'; // or from env

  static getInstance() {
    if (!OperatorService.instance) {
      OperatorService.instance = new OperatorService();
    }
    return OperatorService.instance;
  }

  async getOperator() {
    let operator = await Operator.findOne({ operatorId: this.operatorId });
    if (!operator) {
      operator = await Operator.create({
        operatorId: this.operatorId,
        houseBalance: 0,
        commissionRate: 0.2,
        totalDeposited: 0,
        isActive: true,
        maxExposureMultiplier: 1000,
        riskLimitFactor: 0.5,
      });
    }
    return operator;
  }

  async pause(adminId: mongoose.Types.ObjectId, adminTelegramId: number): Promise<boolean> {
    const operator = await this.getOperator();
    if (!operator.isActive) {
      return false; // already paused
    }
    operator.isActive = false;
    await operator.save();

    await auditService.logAdminAction(
      adminId,
      adminTelegramId,
      'BOT_PAUSED',
      'SYSTEM',
      'Operator',
      operator._id.toString(),
      { status: 'paused' }
    );

    logger.info(`Bot paused by admin ${adminTelegramId}`);
    return true;
  }

  async resume(adminId: mongoose.Types.ObjectId, adminTelegramId: number): Promise<boolean> {
    const operator = await this.getOperator();
    if (operator.isActive) {
      return false; // already active
    }
    operator.isActive = true;
    await operator.save();

    await auditService.logAdminAction(
      adminId,
      adminTelegramId,
      'BOT_RESUMED',
      'SYSTEM',
      'Operator',
      operator._id.toString(),
      { status: 'active' }
    );

    logger.info(`Bot resumed by admin ${adminTelegramId}`);
    return true;
  }

  async togglePause(adminId: mongoose.Types.ObjectId, adminTelegramId: number): Promise<boolean> {
    const operator = await this.getOperator();
    operator.isActive = !operator.isActive;
    await operator.save();

    const action = operator.isActive ? 'BOT_RESUMED' : 'BOT_PAUSED';
    await auditService.logAdminAction(
      adminId,
      adminTelegramId,
      action,
      'SYSTEM',
      'Operator',
      operator._id.toString(),
      { status: operator.isActive ? 'active' : 'paused' }
    );

    logger.info(`Bot ${operator.isActive ? 'resumed' : 'paused'} by admin ${adminTelegramId}`);
    return operator.isActive;
  }
}

export const operatorService = OperatorService.getInstance();