import React from 'react';
import { Download, FileSpreadsheet, Loader2 } from 'lucide-react';
import { ActivityLog } from './types';
import toast from 'react-hot-toast';

interface ExportButtonProps {
  logs: ActivityLog[];
}

export const ExportButton: React.FC<ExportButtonProps> = ({ logs }) => {
  const [isExporting, setIsExporting] = React.useState(false);

  const handleExportCSV = () => {
    if (logs.length === 0) {
      toast.error('No logs available to export.');
      return;
    }
    
    setIsExporting(true);
    
    try {
      // Create CSV content
      const headers = ['ID', 'Timestamp', 'Severity', 'Category', 'Status', 'Action', 'Details', 'User Name', 'User Email', 'Resolver Notes', 'Resolution Time (ms)'];
      const rows = logs.map(log => [
        log.id,
        log.timestamp || (log.createdAt?.toDate ? log.createdAt.toDate().toISOString() : log.createdAt),
        log.severity,
        log.category,
        log.status,
        `"${(log.action || '').replace(/"/g, '""')}"`,
        `"${(log.details || '').replace(/"/g, '""')}"`,
        `"${(log.user?.name || '').replace(/"/g, '""')}"`,
        log.user?.email || '',
        `"${(log.resolutionNote || '').replace(/"/g, '""')}"`,
        log.resolutionTime || ''
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map(e => e.join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      
      const dateStr = new Date().toISOString().split('T')[0];
      link.setAttribute('download', `luminia_activity_report_${dateStr}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success(`Successfully exported ${logs.length} logs to CSV!`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to generate export file.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <button 
      onClick={handleExportCSV}
      disabled={isExporting}
      className="flex items-center gap-3 px-8 py-4 bg-white/5 border border-white/10 rounded-[1.5rem] font-black uppercase tracking-widest text-[10px] text-slate-400 hover:text-white hover:bg-white/10 transition-all active:scale-95 disabled:opacity-50"
    >
      {isExporting ? (
        <Loader2 size={16} className="animate-spin" />
      ) : (
        <FileSpreadsheet size={16} className="text-emerald-400" />
      )}
      Export Report
    </button>
  );
};
