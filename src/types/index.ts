export type UserRole = 'admin' | 'member';
export type MembershipStatus = 'active' | 'suspended' | 'expired';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  membershipStatus: MembershipStatus;
  firebaseUid: string;
  createdAt: string;
  isPro?: boolean;
  photoURL?: string;
}

export interface Book {
  id: string;
  isbn: string;
  title: string;
  author: string;
  genre: string;
  totalCopies: number;
  availableCopies: number;
  description: string;
  coverUrl: string;
}

export interface Transaction {
  id: string;
  userId: string;
  bookId: string;
  issueDate: string;
  dueDate: string;
  returnDate?: string;
  fineAmount: number;
  status: 'borrowed' | 'returned' | 'overdue';
}

export interface Reservation {
  id: string;
  userId: string;
  bookId: string;
  reservationDate: string;
  status: 'pending' | 'fulfilled' | 'cancelled';
  isPro?: boolean;
}

export interface ActivityLog {
  id: string;
  type: 'user' | 'admin' | 'system' | 'member';
  user?: {
    name: string;
    photoURL?: string;
  };
  action: string;
  details: string;
  metadata?: string;
  timestamp: string;
  status: 'SUCCESS' | 'WARNING' | 'INFO' | 'ERROR';
}
