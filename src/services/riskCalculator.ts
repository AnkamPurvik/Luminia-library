import { db } from '../lib/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';

export interface LoanWithRisk {
  id: string;
  bookId: string;
  bookTitle: string;
  userId: string;
  userName: string;
  dueDate: any; // Can be Timestamp, string, or Date
  borrowedDate: any; // Can be Timestamp, string, or Date
  riskScore: number;
  riskFactors: {
    userReliability: number;
    bookDemand: number;
    timePressure: number;
    historicalPattern: number;
  };
  predictedReturnDate?: Date;
  confidenceLevel: number;
}

export class RiskCalculator {
  
  // Calculate REAL risk score (0-100)
  async calculateRiskScore(loan: any): Promise<LoanWithRisk> {
    
    // 1. USER RELIABILITY SCORE (40% weight)
    const userReliability = await this.getUserReliabilityScore(loan.userId);
    
    // 2. BOOK DEMAND SCORE (25% weight)
    const bookDemand = await this.getBookDemandScore(loan.bookId);
    
    // 3. TIME PRESSURE SCORE (20% weight)
    const timePressure = this.getTimePressureScore(loan.dueDate);
    
    // 4. HISTORICAL PATTERN SCORE (15% weight)
    const historicalPattern = await this.getHistoricalPatternScore(loan.userId, loan.bookId);
    
    // Calculate weighted risk score
    const riskScore = Math.min(100, Math.max(0,
      (userReliability * 0.40) +
      (bookDemand * 0.25) +
      (timePressure * 0.20) +
      (historicalPattern * 0.15)
    ));
    
    // Parse Dates safely
    let borrowedDateObj = new Date();
    if (loan.borrowedDate?.toDate) borrowedDateObj = loan.borrowedDate.toDate();
    else if (loan.borrowed_at?.toDate) borrowedDateObj = loan.borrowed_at.toDate();
    else if (loan.issueDate?.toDate) borrowedDateObj = loan.issueDate.toDate();
    else if (loan.borrowedDate) borrowedDateObj = new Date(loan.borrowedDate);
    else if (loan.borrowed_at) borrowedDateObj = new Date(loan.borrowed_at);
    else if (loan.issueDate) borrowedDateObj = new Date(loan.issueDate);

    let dueDateObj = new Date();
    if (loan.dueDate?.toDate) dueDateObj = loan.dueDate.toDate();
    else if (loan.dueDate) dueDateObj = new Date(loan.dueDate);
    
    // Predict return date using ML-inspired algorithm
    const predictedReturnDate = this.predictReturnDate(
      borrowedDateObj,
      dueDateObj,
      userReliability,
      historicalPattern
    );
    
    return {
      id: loan.id,
      bookId: loan.bookId || '',
      bookTitle: loan.bookTitle || 'Unknown Book',
      userId: loan.userId || '',
      userName: loan.userName || 'Anonymous Member',
      dueDate: dueDateObj,
      borrowedDate: borrowedDateObj,
      riskScore: Math.round(riskScore),
      riskFactors: {
        userReliability: Math.round(userReliability),
        bookDemand: Math.round(bookDemand),
        timePressure: Math.round(timePressure),
        historicalPattern: Math.round(historicalPattern)
      },
      predictedReturnDate,
      confidenceLevel: this.calculateConfidence(userReliability, historicalPattern)
    };
  }
  
  // USER RELIABILITY SCORE (0-100)
  private async getUserReliabilityScore(userId: string): Promise<number> {
    try {
      // Query index-safe to avoid composite index requirements
      const q = query(
        collection(db, 'transactions'),
        where('userId', '==', userId)
      );
      const snap = await getDocs(q);
      
      if (snap.empty) return 50; // Neutral for new users
      
      let totalLoans = 0;
      let lateReturns = 0;
      let totalLateDays = 0;
      let hasLostBook = false;
      
      // Filter & process in memory
      const docs = snap.docs
        .map(d => d.data())
        .filter(data => data.status === 'returned' || data.status === 'overdue');

      if (docs.length === 0) return 50;
      
      docs.forEach(data => {
        totalLoans++;
        
        // Check for late return
        if (data.returnDate && data.dueDate) {
          let returnDate = new Date();
          if (data.returnDate?.toDate) returnDate = data.returnDate.toDate();
          else returnDate = new Date(data.returnDate);

          let dueDate = new Date();
          if (data.dueDate?.toDate) dueDate = data.dueDate.toDate();
          else dueDate = new Date(data.dueDate);

          if (returnDate > dueDate) {
            lateReturns++;
            const daysLate = Math.ceil((returnDate.getTime() - dueDate.getTime()) / (1000 * 3600 * 24));
            totalLateDays += daysLate;
          }
        }
        
        // Check for lost/damaged
        if (data.status === 'lost' || data.damaged) {
          hasLostBook = true;
        }
      });
      
      // Calculate on-time percentage
      const onTimePercentage = totalLoans > 0 
        ? ((totalLoans - lateReturns) / totalLoans) * 100 
        : 100;
      
      // Penalize lost books significantly
      const lostBookPenalty = hasLostBook ? 30 : 0;
      
      // Calculate average late days penalty
      const avgLateDays = lateReturns > 0 ? totalLateDays / lateReturns : 0;
      const latePenalty = Math.min(25, avgLateDays * 2);
      
      // Final score: on-time percentage minus penalties
      const score = Math.max(0, onTimePercentage - lostBookPenalty - latePenalty);
      
      return Math.min(100, score);
    } catch (err) {
      console.warn('Error calculating user reliability score, returning fallback:', err);
      return 50;
    }
  }
  
  // BOOK DEMAND SCORE (0-100)
  private async getBookDemandScore(bookId: string): Promise<number> {
    try {
      // Get current reservations/waitlist
      const qRes = query(
        collection(db, 'reservations'),
        where('bookId', '==', bookId),
        where('status', '==', 'pending')
      );
      const reservationsSnap = await getDocs(qRes);
      const waitlistCount = reservationsSnap.size;
      
      // Get book details
      const bookDoc = await getDoc(doc(db, 'books', bookId));
      const book = bookDoc.exists() ? bookDoc.data() : null;
      
      if (!book) return 30;
      
      // Calculate copies ratio
      const totalCopies = book.totalCopies || 1;
      const availableCopies = book.availableCopies || 0;
      const utilizationRate = ((totalCopies - availableCopies) / totalCopies) * 100;
      
      // Waitlist impact
      let waitlistScore = 0;
      if (waitlistCount > 0) {
        waitlistScore = Math.min(40, waitlistCount * 10); // Up to 40 points
      }
      
      // Utilization impact
      let utilizationScore = utilizationRate * 0.6; // Up to 60 points
      
      // Historical late return rate for this book
      const lateRate = await this.getBookLateReturnRate(bookId);
      const latePenalty = lateRate * 0.5; // Up to 50 points penalty
      
      const demandScore = Math.min(100, waitlistScore + utilizationScore - latePenalty);
      
      return Math.max(0, demandScore);
    } catch (err) {
      console.warn('Error calculating book demand, returning default:', err);
      return 30;
    }
  }
  
  // TIME PRESSURE SCORE (0-100)
  private getTimePressureScore(dueDate: any): number {
    const now = new Date();
    let due = new Date();
    if (dueDate?.toDate) due = dueDate.toDate();
    else if (dueDate) due = new Date(dueDate);

    const daysUntilDue = Math.ceil((due.getTime() - now.getTime()) / (1000 * 3600 * 24));
    
    // Already overdue
    if (daysUntilDue < 0) {
      const daysOverdue = Math.abs(daysUntilDue);
      return Math.min(100, 70 + (daysOverdue * 5));
    }
    
    // Due today
    if (daysUntilDue === 0) return 85;
    
    // Due within 3 days
    if (daysUntilDue <= 3) return 75;
    
    // Due within a week
    if (daysUntilDue <= 7) return 60;
    
    // Due within 2 weeks
    if (daysUntilDue <= 14) return 40;
    
    // Due within month
    if (daysUntilDue <= 30) return 20;
    
    return 5;
  }
  
  // HISTORICAL PATTERN SCORE (0-100)
  private async getHistoricalPatternScore(userId: string, bookId: string): Promise<number> {
    try {
      // Check if user has borrowed this specific book before
      const qPrev = query(
        collection(db, 'transactions'),
        where('userId', '==', userId),
        where('bookId', '==', bookId)
      );
      const previousLoans = await getDocs(qPrev);
      
      let patternScore = 50; // Neutral start
      
      if (!previousLoans.empty) {
        let wasLate = false;
        let returnedEarly = false;
        
        previousLoans.forEach(d => {
          const data = d.data();
          if (data.status === 'returned' && data.returnDate && data.dueDate) {
            let returnDate = new Date();
            if (data.returnDate?.toDate) returnDate = data.returnDate.toDate();
            else returnDate = new Date(data.returnDate);

            let dueDate = new Date();
            if (data.dueDate?.toDate) dueDate = data.dueDate.toDate();
            else dueDate = new Date(data.dueDate);
            
            if (returnDate > dueDate) {
              wasLate = true;
            } else if (returnDate < dueDate) {
              returnedEarly = true;
            }
          }
        });
        
        if (wasLate) {
          patternScore = 70; // Higher risk if late before
        } else if (returnedEarly) {
          patternScore = 20; // Lower risk if returned early
        }
      }
      
      // Check user's borrowing frequency
      const qUser = query(
        collection(db, 'transactions'),
        where('userId', '==', userId),
        where('status', '==', 'borrowed')
      );
      const userLoans = await getDocs(qUser);
      const activeLoansCount = userLoans.size;
      
      // Users with many active loans are higher risk
      if (activeLoansCount >= 5) {
        patternScore += 15;
      } else if (activeLoansCount >= 3) {
        patternScore += 5;
      }
      
      return Math.min(100, patternScore);
    } catch (err) {
      console.warn('Error calculating historical pattern score:', err);
      return 50;
    }
  }
  
  // PREDICT RETURN DATE using statistical modeling
  private predictReturnDate(borrowedDate: Date, dueDate: Date, userReliability: number, historicalPattern: number): Date {
    const borrowed = new Date(borrowedDate);
    const due = new Date(dueDate);
    const totalLoanPeriod = due.getTime() - borrowed.getTime();
    const daysIntoLoan = (Date.now() - borrowed.getTime()) / (1000 * 3600 * 24);
    const totalDaysAllowed = Math.max(1, totalLoanPeriod / (1000 * 3600 * 24));
    
    // Calculate prediction multiplier based on user behavior
    let multiplier = 1;
    
    if (userReliability > 80) {
      multiplier = 0.7; // Likely to return early
    } else if (userReliability < 40) {
      multiplier = 1.3; // Likely to return late
    }
    
    if (historicalPattern > 65) {
      multiplier *= 1.2; // Pattern shows lateness
    }
    
    // Predict return day
    const predictedDays = Math.min(totalDaysAllowed * multiplier, totalDaysAllowed + 14);
    const predictedDate = new Date(borrowed);
    predictedDate.setDate(borrowed.getDate() + Math.round(predictedDays));
    
    return predictedDate;
  }
  
  // CONFIDENCE LEVEL of prediction
  private calculateConfidence(userReliability: number, historicalPattern: number): number {
    // More data = higher confidence
    let confidence = 60; // Base confidence
    
    if (userReliability > 20 && userReliability < 100) {
      confidence += 20;
    }
    
    if (historicalPattern !== 50) {
      confidence += 15;
    }
    
    return Math.min(95, confidence);
  }
  
  // Helper: Get book's historical late return rate
  private async getBookLateReturnRate(bookId: string): Promise<number> {
    try {
      const q = query(
        collection(db, 'transactions'),
        where('bookId', '==', bookId)
      );
      const returns = await getDocs(q);
      
      const returnedDocs = returns.docs
        .map(d => d.data())
        .filter(d => d.status === 'returned');

      if (returnedDocs.length === 0) return 0;
      
      let lateCount = 0;
      returnedDocs.forEach(data => {
        if (data.returnDate && data.dueDate) {
          let returnDate = new Date();
          if (data.returnDate?.toDate) returnDate = data.returnDate.toDate();
          else returnDate = new Date(data.returnDate);

          let dueDate = new Date();
          if (data.dueDate?.toDate) dueDate = data.dueDate.toDate();
          else dueDate = new Date(data.dueDate);

          if (returnDate > dueDate) {
            lateCount++;
          }
        }
      });
      
      return (lateCount / returnedDocs.length) * 100;
    } catch (err) {
      return 0;
    }
  }
}
