import { ActivityLog, SeverityType, CategoryType } from './types';

export function getDynamicSeverity(log: any): SeverityType {
  if (log.severity) return log.severity;
  
  const action = (log.action || '').toLowerCase();
  const details = (log.details || '').toLowerCase();
  const status = (log.status || '').toUpperCase();
  const type = log.type || '';

  if (
    status === 'ERROR' || 
    action.includes('failed') || 
    action.includes('crash') || 
    action.includes('unauthorized') || 
    action.includes('suspicious') || 
    action.includes('compromise') || 
    action.includes('missing') || 
    action.includes('damaged') ||
    details.includes('critical')
  ) {
    return 'CRITICAL';
  }
  
  if (
    status === 'WARNING' || 
    action.includes('overdue') || 
    action.includes('limit') || 
    action.includes('warn') || 
    action.includes('bulk') ||
    details.includes('warning')
  ) {
    return 'HIGH';
  }

  if (
    action.includes('registered') || 
    action.includes('return') || 
    action.includes('update') || 
    action.includes('password') || 
    action.includes('add') || 
    type === 'member' ||
    type === 'chat'
  ) {
    return 'MEDIUM';
  }

  return 'LOW';
}

export function getDynamicCategory(log: any): CategoryType {
  if (log.category) return log.category;
  
  const action = (log.action || '').toLowerCase();
  const type = log.type || '';

  if (
    action.includes('login') || 
    action.includes('auth') || 
    action.includes('password') || 
    action.includes('security') ||
    action.includes('suspicious')
  ) {
    return 'security';
  }

  if (
    action.includes('book') || 
    action.includes('catalog') || 
    action.includes('inventory') || 
    action.includes('stock') ||
    action.includes('copies')
  ) {
    return 'inventory';
  }

  if (
    action.includes('borrow') || 
    action.includes('return') || 
    action.includes('overdue') || 
    action.includes('loan') ||
    action.includes('fine')
  ) {
    return 'loans';
  }

  if (
    action.includes('member') || 
    action.includes('register') || 
    type === 'member'
  ) {
    return 'members';
  }

  if (
    action.includes('setting') || 
    action.includes('theme') || 
    action.includes('preference') ||
    action.includes('configuration')
  ) {
    return 'settings';
  }

  return 'system';
}

export function useCriticalAlerts(logs: any[]) {
  const processedLogs = logs.map(log => ({
    ...log,
    severity: getDynamicSeverity(log),
    category: getDynamicCategory(log),
    status: log.status || 'PENDING'
  })) as ActivityLog[];

  const counts = {
    CRITICAL: processedLogs.filter(l => l.severity === 'CRITICAL' && l.status !== 'RESOLVED').length,
    HIGH: processedLogs.filter(l => l.severity === 'HIGH' && l.status !== 'RESOLVED').length,
    MEDIUM: processedLogs.filter(l => l.severity === 'MEDIUM' && l.status !== 'RESOLVED').length,
    LOW: processedLogs.filter(l => l.severity === 'LOW' && l.status !== 'RESOLVED').length,
  };

  return {
    processedLogs,
    counts,
  };
}
