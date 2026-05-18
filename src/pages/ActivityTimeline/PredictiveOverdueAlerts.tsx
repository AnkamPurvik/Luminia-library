import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, TrendingUp, Users, BookOpen, Calendar, Clock, Loader2 } from 'lucide-react';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { RiskCalculator, LoanWithRisk } from '../../services/riskCalculator';
import { useNotifications } from '../../context/NotificationContext';

export default function PredictiveOverdueAlerts() {
  const [highRiskLoans, setHighRiskLoans] = useState<LoanWithRisk[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    avgRiskScore: 0,
    highRiskCount: 0,
    criticalRiskCount: 0,
    predictedOverdueRate: 0
  });
  
  const { sendNotification, showToast } = useNotifications();
  const riskCalculator = new RiskCalculator();
  
  useEffect(() => {
    fetchAndAnalyzeLoans();
    
    // Refresh every 10 minutes
    const interval = setInterval(fetchAndAnalyzeLoans, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);
  
  const fetchAndAnalyzeLoans = async () => {
    setIsLoading(true);
    try {
      // Fetch all active loans - query is simple to prevent index failures
      const loansQuery = query(
        collection(db, 'transactions')
      );
      
      const loansSnapshot = await getDocs(loansQuery);
      
      const activeLoans = loansSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter((l: any) => l.status === 'borrowed' || l.status === 'overdue');
      
      // Calculate risk for each active loan in parallel
      const riskAnalysis = await Promise.all(
        activeLoans.map(async loan => {
          return await riskCalculator.calculateRiskScore(loan);
        })
      );
      
      // Sort by risk score (highest first)
      const sorted = riskAnalysis.sort((a, b) => b.riskScore - a.riskScore);
      setHighRiskLoans(sorted);
      
      // Calculate stats
      const highRisk = sorted.filter(l => l.riskScore >= 70);
      const criticalRisk = sorted.filter(l => l.riskScore >= 90);
      const avgRisk = sorted.reduce((sum, l) => sum + l.riskScore, 0) / (sorted.length || 1);
      
      setStats({
        avgRiskScore: Math.round(avgRisk),
        highRiskCount: highRisk.length,
        criticalRiskCount: criticalRisk.length,
        predictedOverdueRate: Math.round((highRisk.length / (sorted.length || 1)) * 100)
      });
      
      // Send alerts for critical risk loans
      for (const loan of criticalRisk) {
        const daysLeft = Math.ceil((new Date(loan.dueDate).getTime() - Date.now()) / (1000 * 3600 * 24));
        await sendNotification({
          userId: loan.userId,
          title: '⚠️ Critical Overdue Risk',
          message: `The book "${loan.bookTitle}" has a ${loan.riskScore}% chance of becoming overdue. Due in ${daysLeft} days.`,
          type: 'critical',
          category: 'loan',
          priority: 'high',
          metadata: {
            bookId: loan.bookId,
            transactionId: loan.id,
            actionUrl: `/dashboard`,
            actionLabel: 'View Checkout'
          }
        });
      }
      
    } catch (error) {
      console.error('Risk analysis failed:', error);
      showToast('Risk analysis failed. Using simulated model predictions.', 'warning');
      setHighRiskLoans(getFallbackLoans());
    } finally {
      setIsLoading(false);
    }
  };
  
  const getRiskColorClass = (score: number): string => {
    if (score >= 90) return 'text-rose-400 bg-rose-500/10 border-rose-500/20';
    if (score >= 70) return 'text-orange-400 bg-orange-500/10 border-orange-500/20';
    if (score >= 50) return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
    if (score >= 30) return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
    return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
  };

  const getRiskProgressColor = (score: number): string => {
    if (score >= 90) return 'bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.4)]';
    if (score >= 70) return 'bg-orange-500 shadow-[0_0_12px_rgba(249,115,22,0.4)]';
    if (score >= 50) return 'bg-amber-500';
    if (score >= 30) return 'bg-yellow-500';
    return 'bg-emerald-500';
  };
  
  const getRiskLabel = (score: number): string => {
    if (score >= 90) return 'CRITICAL RISK';
    if (score >= 70) return 'HIGH RISK';
    if (score >= 50) return 'MEDIUM RISK';
    if (score >= 30) return 'LOW RISK';
    return 'MINIMAL RISK';
  };
  
  const getDaysUntilDue = (dueDate: Date): number => {
    return Math.ceil((new Date(dueDate).getTime() - Date.now()) / (1000 * 3600 * 24));
  };
  
  if (isLoading) {
    return (
      <div className="glass-panel rounded-[2rem] border-white/5 p-16 text-center flex flex-col items-center justify-center">
        <Loader2 className="animate-spin text-primary-accent mb-4" size={32} />
        <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Running ML-inspired risk projections...</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-8">
      {/* Statistics Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="glass-panel rounded-2xl p-4.5 border-white/5 bg-indigo-500/[0.01] hover:bg-white/[0.02] transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[8px] font-black uppercase tracking-widest text-slate-500">Avg Risk</span>
            <TrendingUp size={14} className="text-orange-400" />
          </div>
          <p className="text-2xl font-black text-white">{stats.avgRiskScore}%</p>
          <p className="text-[7px] text-slate-600 mt-1 uppercase font-bold tracking-wider">Across active loans</p>
        </div>
        
        <div className="glass-panel rounded-2xl p-4.5 border-white/5 bg-orange-500/[0.01] hover:bg-white/[0.02] transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[8px] font-black uppercase tracking-widest text-slate-500">High Risk</span>
            <AlertTriangle size={14} className="text-orange-400" />
          </div>
          <p className="text-2xl font-black text-white">{stats.highRiskCount}</p>
          <p className="text-[7px] text-slate-600 mt-1 uppercase font-bold tracking-wider">Loans &gt;70% risk</p>
        </div>
        
        <div className="glass-panel rounded-2xl p-4.5 border-white/5 bg-rose-500/[0.01] hover:bg-white/[0.02] transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[8px] font-black uppercase tracking-widest text-slate-500">Critical</span>
            <AlertTriangle size={14} className="text-rose-400 animate-pulse" />
          </div>
          <p className="text-2xl font-black text-white">{stats.criticalRiskCount}</p>
          <p className="text-[7px] text-slate-600 mt-1 uppercase font-bold tracking-wider">&gt;90% overdue prob</p>
        </div>
        
        <div className="glass-panel rounded-2xl p-4.5 border-white/5 bg-cyan-500/[0.01] hover:bg-white/[0.02] transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[8px] font-black uppercase tracking-widest text-slate-500">Projected</span>
            <Clock size={14} className="text-cyan-400" />
          </div>
          <p className="text-2xl font-black text-white">{stats.predictedOverdueRate}%</p>
          <p className="text-[7px] text-slate-600 mt-1 uppercase font-bold tracking-wider">Expected Overdue Rate</p>
        </div>
      </div>
      
      {/* High Risk Loans List */}
      <div className="glass-panel rounded-[2rem] overflow-hidden border-white/5">
        <div className="p-6 border-b border-white/5 bg-white/[0.01]">
          <h3 className="text-white font-black uppercase tracking-wider text-sm flex items-center gap-3">
            <AlertTriangle size={18} className="text-orange-400 animate-pulse" />
            ML-Powered Predictive Risk Log
          </h3>
          <p className="text-slate-500 text-[9px] font-black uppercase tracking-widest mt-1.5 leading-relaxed">
            Real-time latency metrics calculated via return history coefficients, current queue queues, and checkout intervals
          </p>
        </div>
        
        <div className="divide-y divide-white/5">
          <AnimatePresence mode="popLayout">
            {highRiskLoans.slice(0, 10).map((loan, idx) => {
              const daysLeft = getDaysUntilDue(loan.dueDate);
              const isOverdue = daysLeft < 0;
              
              return (
                <motion.div
                  key={loan.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="p-6 hover:bg-white/[0.01] transition-all"
                >
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <BookOpen size={15} className="text-primary-accent shrink-0" />
                        <h4 className="text-white font-black text-sm uppercase tracking-tight truncate max-w-[280px]">{loan.bookTitle}</h4>
                        <span className={`px-2.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border ${
                          isOverdue ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                        }`}>
                          {isOverdue ? 'OVERDUE' : `${daysLeft} days left`}
                        </span>
                      </div>
                      
                      <p className="text-slate-500 text-[10px] uppercase font-bold tracking-wider mb-4">
                        Borrower: <span className="text-white font-black">{loan.userName}</span>
                      </p>
                      
                      {/* Risk Score Bar */}
                      <div className="space-y-2">
                        <div className="flex justify-between text-[9px]">
                          <span className="text-slate-500 font-black uppercase tracking-widest">Calculated Overdue Coefficient</span>
                          <div className="flex gap-2.5 items-center">
                            <span className="text-white font-black">{loan.riskScore}%</span>
                            <span className={`px-2 py-0.5 rounded border text-[7.5px] font-black uppercase tracking-widest ${getRiskColorClass(loan.riskScore)}`}>
                              {getRiskLabel(loan.riskScore)}
                            </span>
                          </div>
                        </div>
                        <div className="h-2.5 bg-white/5 rounded-full overflow-hidden border border-white/5 p-[1px]">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${loan.riskScore}%` }}
                            className={`h-full rounded-full ${getRiskProgressColor(loan.riskScore)}`}
                          />
                        </div>
                      </div>
                      
                      {/* Risk Factors Breakdown */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5 pt-4 border-t border-white/5 text-center">
                        <div>
                          <p className="text-[7.5px] text-slate-500 font-black uppercase tracking-widest">User Reliability</p>
                          <p className="text-xs font-black text-white mt-1 uppercase tracking-tight">{loan.riskFactors.userReliability}%</p>
                        </div>
                        <div>
                          <p className="text-[7.5px] text-slate-500 font-black uppercase tracking-widest">Book Demand</p>
                          <p className="text-xs font-black text-white mt-1 uppercase tracking-tight">{loan.riskFactors.bookDemand}%</p>
                        </div>
                        <div>
                          <p className="text-[7.5px] text-slate-500 font-black uppercase tracking-widest">Time Pressure</p>
                          <p className="text-xs font-black text-white mt-1 uppercase tracking-tight">{loan.riskFactors.timePressure}%</p>
                        </div>
                        <div>
                          <p className="text-[7.5px] text-slate-500 font-black uppercase tracking-widest">Historical Pattern</p>
                          <p className="text-xs font-black text-white mt-1 uppercase tracking-tight">{loan.riskFactors.historicalPattern}%</p>
                        </div>
                      </div>
                      
                      {/* Prediction */}
                      {loan.predictedReturnDate && (
                        <div className="mt-4 p-3 bg-primary-accent/[0.02] rounded-xl border border-primary-accent/10">
                          <div className="flex items-center gap-2 text-[9px] flex-wrap">
                            <Calendar size={12} className="text-primary-accent shrink-0" />
                            <span className="text-slate-400 uppercase font-bold tracking-wider">Estimated Return:</span>
                            <span className="text-white font-black uppercase tracking-wider">
                              {loan.predictedReturnDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                            <span className="text-slate-500 uppercase font-black tracking-wider">
                              (Confidence: {loan.confidenceLevel}%)
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="flex md:flex-col gap-3 shrink-0 w-full md:w-auto mt-2 md:mt-0">
                      <button
                        onClick={() => {
                          sendNotification({
                            userId: loan.userId,
                            title: '📚 Friendly Return Notice',
                            message: `The book "${loan.bookTitle}" has highly active reserves and is due in ${Math.abs(daysLeft)} days. Please arrange return to maintain high account reliability.`,
                            type: 'warning',
                            category: 'loan',
                            priority: 'medium',
                            metadata: {
                              transactionId: loan.id,
                              actionUrl: `/dashboard`,
                              actionLabel: 'Check Status'
                            }
                          });
                          showToast(`Notification alert dispatched to ${loan.userName}`, 'success');
                        }}
                        className="flex-1 md:flex-none px-4 py-2.5 bg-primary-accent/10 border border-primary-accent/20 rounded-xl text-[9px] font-black uppercase tracking-widest text-primary-accent hover:bg-primary-accent hover:text-white transition-all whitespace-nowrap"
                      >
                        Send Reminder
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
          
          {highRiskLoans.length === 0 && (
            <div className="p-16 text-center space-y-4">
              <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mx-auto">
                <Users size={20} className="text-slate-600" />
              </div>
              <div>
                <p className="text-slate-500 font-black uppercase tracking-widest text-xs">No active loans flagged</p>
                <p className="text-slate-600 text-[9px] uppercase mt-1 tracking-wider">All checkouts are fully aligned with library limits</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Fallback data for demo/empty state
function getFallbackLoans(): LoanWithRisk[] {
  return [
    {
      id: '1',
      bookId: 'demo1',
      bookTitle: 'The Odyssey',
      userId: 'purvik',
      userName: 'Purvik',
      dueDate: new Date(Date.now() + 2 * 24 * 3600 * 1000),
      borrowedDate: new Date(Date.now() - 12 * 24 * 3600 * 1000),
      riskScore: 87,
      riskFactors: { userReliability: 45, bookDemand: 82, timePressure: 75, historicalPattern: 65 },
      predictedReturnDate: new Date(Date.now() + 4 * 24 * 3600 * 1000),
      confidenceLevel: 72
    },
    {
      id: '2',
      bookId: 'demo2',
      bookTitle: 'Jane Eyre',
      userId: 'johndoe',
      userName: 'John Doe',
      dueDate: new Date(Date.now() + 4 * 24 * 3600 * 1000),
      borrowedDate: new Date(Date.now() - 10 * 24 * 3600 * 1000),
      riskScore: 64,
      riskFactors: { userReliability: 50, bookDemand: 90, timePressure: 45, historicalPattern: 50 },
      predictedReturnDate: new Date(Date.now() + 6 * 24 * 3600 * 1000),
      confidenceLevel: 80
    }
  ];
}
