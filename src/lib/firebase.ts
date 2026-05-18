import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, collection, addDoc, Timestamp } from 'firebase/firestore';
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
