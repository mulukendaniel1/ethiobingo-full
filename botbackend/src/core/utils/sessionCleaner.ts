// src/core/utils/sessionCleaner.ts - UPDATED
import { logger } from './logger';

export class SessionCleaner {
  /**
   * Clear session state after action completion but preserve UI preferences
   */
  static clearSession(session: any): void {
    try {
      if (!session) return;
      
      // Save UI preferences before clearing
      const menuExpanded = session.menuExpanded;
      
      // Clear workflow-specific data
      session.step = undefined;
      session.jobId = undefined;
      session.payoutState = undefined;
      session.payoutAmount = undefined;
      session.conversationStep = undefined;
      session.tempData = {};
      session.broadcastMessage = undefined;
      session.broadcastId = undefined;
      
      // Restore UI preferences
      if (menuExpanded !== undefined) {
        session.menuExpanded = menuExpanded;
      } else {
        session.menuExpanded = true; // Default
      }
      
      logger.debug('Session cleared (UI preferences preserved)');
    } catch (error) {
      logger.warn('Failed to clear session:', error);
    }
  }
  
  /**
   * Validate and fix session data
   */
  static validateSession(session: any): any {
    if (!session) {
      return this.getDefaultSession();
    }
    
    // Convert null values to undefined
    const keys = Object.keys(session);
    for (const key of keys) {
      if (session[key] === null) {
        session[key] = undefined;
      }
    }
    
    // Ensure all required fields exist
    const defaultSession = this.getDefaultSession();
    
    // Merge with defaults, but don't override existing non-undefined values
    const result = { ...defaultSession };
    
    for (const key of keys) {
      if (session[key] !== undefined) {
        result[key] = session[key];
      }
    }
    
    // Ensure tempData is an object
    if (!result.tempData || typeof result.tempData !== 'object') {
      result.tempData = {};
    }
    
    return result;
  }
  
  /**
   * Get default session structure
   */
  private static getDefaultSession(): any {
    return {
      step: undefined,
      jobId: undefined,
      payoutState: undefined,
      payoutAmount: undefined,
      conversationStep: undefined,
      tempData: {},
      broadcastMessage: undefined,
      broadcastId: undefined,
      menuExpanded: true
    };
  }
}