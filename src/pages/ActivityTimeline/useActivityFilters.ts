import { useState, useMemo } from 'react';
import { ActivityLog, SeverityType, CategoryType } from './types';

export interface FilterState {
  severities: SeverityType[];
  categories: CategoryType[];
  dateRange: 'all' | 'today' | 'week' | 'month' | 'custom';
  startDate: string;
  endDate: string;
  userSearch: string;
  showLow: boolean;
}

export const INITIAL_FILTERS: FilterState = {
  severities: ['CRITICAL', 'HIGH', 'MEDIUM'], // CRITICAL + HIGH + MEDIUM by default
  categories: [],
  dateRange: 'all',
  startDate: '',
  endDate: '',
  userSearch: '',
  showLow: false
};

export function useActivityFilters(logs: ActivityLog[]) {
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      // 1. Severity Filter
      if (filters.severities.length > 0 && !filters.severities.includes(log.severity)) {
        return false;
      }
      
      // If "Show all activity" is false, exclude LOW by default unless explicitly checked
      if (!filters.showLow && log.severity === 'LOW') {
        return false;
      }

      // 2. Category Filter
      if (filters.categories.length > 0 && !filters.categories.includes(log.category)) {
        return false;
      }

      // 3. Date Range Filter
      const logDate = log.createdAt?.toDate ? log.createdAt.toDate() : new Date(log.timestamp || log.createdAt);
      const now = new Date();

      if (filters.dateRange === 'today') {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        if (logDate < todayStart) return false;
      } else if (filters.dateRange === 'week') {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        if (logDate < weekAgo) return false;
      } else if (filters.dateRange === 'month') {
        const monthAgo = new Date();
        monthAgo.setDate(monthAgo.getDate() - 30);
        if (logDate < monthAgo) return false;
      } else if (filters.dateRange === 'custom') {
        if (filters.startDate) {
          const start = new Date(filters.startDate);
          start.setHours(0,0,0,0);
          if (logDate < start) return false;
        }
        if (filters.endDate) {
          const end = new Date(filters.endDate);
          end.setHours(23,59,59,999);
          if (logDate > end) return false;
        }
      }

      // 4. User involved (name or email)
      if (filters.userSearch) {
        const search = filters.userSearch.toLowerCase();
        const userName = (log.user?.name || '').toLowerCase();
        const userEmail = (log.user?.email || '').toLowerCase();
        if (!userName.includes(search) && !userEmail.includes(search)) {
          return false;
        }
      }

      return true;
    });
  }, [logs, filters]);

  const resetFilters = () => setFilters(INITIAL_FILTERS);

  return {
    filters,
    setFilters,
    filteredLogs,
    resetFilters
  };
}
