import { Timestamp } from 'firebase/firestore';

export type SeverityType = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type CategoryType = 'security' | 'inventory' | 'loans' | 'members' | 'system' | 'settings';
export type StatusType = 'PENDING' | 'ACKNOWLEDGED' | 'RESOLVED' | 'DISMISSED';

export interface ActivityLog {
  id: string;
  action: string;
  details: string;
  severity: SeverityType;
  category: CategoryType;
  status: StatusType;
  assignedTo: string | null;       // Librarian UID
  assignedName?: string | null;     // Librarian Name
  resolvedAt: string | null;        // ISO string
  resolutionNote: string | null;
  resolutionTime: number | null;    // Milliseconds to resolve
  alertCount: number;               // Trigger count
  type?: 'user' | 'admin' | 'system' | 'member' | 'chat';
  user?: {
    name: string;
    email?: string;
    photoURL?: string;
    uid?: string;
  };
  metadata?: string;
  timestamp: string;                // Display date
  createdAt: any;                   // Firestore Timestamp
}
