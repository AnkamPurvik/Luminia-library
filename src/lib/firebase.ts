import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, collection, addDoc, Timestamp, doc, getDoc, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';
import { ActivityLog } from '../types';
import toast from 'react-hot-toast';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
}, firebaseConfig.firestoreDatabaseId);
export const storage = getStorage(app);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path
  };
  
  // Cleaned: Removed sensitive authInfo logging to prevent data leaks
  console.error(`Firestore Error [${operationType}] at ${path}:`, errInfo.error);
  toast.error(`${operationType.toUpperCase()} error: ${errInfo.error}`);
  throw new Error(errInfo.error);
}

export async function logActivity(log: Omit<ActivityLog, 'id' | 'timestamp'>) {
  try {
    const user = auth.currentUser;
    if (user) {
      const userSnap = await getDoc(doc(db, 'users', user.uid));
      if (userSnap.exists()) {
        const data = userSnap.data();
        if (data?.preferences?.analyticsOptOut === true) {
          // Analytics opt-out is enabled, skip logging completely
          return;
        }
      }
    }
    await addDoc(collection(db, 'activity_logs'), {
      ...log,
      timestamp: new Date().toISOString(),
      createdAt: Timestamp.now(),
      userId: auth.currentUser?.uid || 'anonymous'
    });
  } catch (err) {
    console.error('Logging error:', err);
  }
}

export async function purgeOldActivityLogs() {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const q = query(
      collection(db, 'activity_logs'),
      where('createdAt', '<', Timestamp.fromDate(thirtyDaysAgo))
    );
    
    const snap = await getDocs(q);
    if (snap.empty) return;
    
    const batch = writeBatch(db);
    snap.forEach(docSnap => {
      batch.delete(docSnap.ref);
    });
    await batch.commit();
    console.log(`Successfully auto-purged ${snap.size} activity logs older than 30 days (TTL cleanup).`);
  } catch (err) {
    console.error('Failed to purge old activity logs:', err);
  }
}
