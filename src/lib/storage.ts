import { VocabItem, UserSettings, QuizSession } from "../types";
import { db, auth } from "./firebase";
import { collection, doc, getDocs, setDoc, writeBatch, deleteDoc } from "firebase/firestore";

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const getVocabItems = async (): Promise<VocabItem[]> => {
  if (!auth.currentUser) return [];
  const path = `users/${auth.currentUser.uid}/vocabItems`;
  try {
    const snapshot = await getDocs(collection(db, path));
    return snapshot.docs.map(doc => doc.data() as VocabItem);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return [];
  }
};

export const saveVocabItems = async (items: VocabItem[]) => {
  if (!auth.currentUser) return;
  const path = `users/${auth.currentUser.uid}/vocabItems`;
  try {
    const batches = [];
    let batch = writeBatch(db);
    let count = 0;
    items.forEach(item => {
      item.ownerId = auth.currentUser!.uid;
      const docRef = doc(db, path, item.id);
      batch.set(docRef, item);
      count++;
      if (count === 490) {
        batches.push(batch.commit());
        batch = writeBatch(db);
        count = 0;
      }
    });
    if (count > 0) {
      batches.push(batch.commit());
    }
    await Promise.all(batches);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const deleteVocabItems = async (itemIds: string[]) => {
  if (!auth.currentUser) return;
  const path = `users/${auth.currentUser.uid}/vocabItems`;
  try {
    const batches = [];
    let batch = writeBatch(db);
    let count = 0;
    itemIds.forEach(id => {
      const docRef = doc(db, path, id);
      batch.delete(docRef);
      count++;
      if (count === 490) {
        batches.push(batch.commit());
        batch = writeBatch(db);
        count = 0;
      }
    });
    if (count > 0) {
      batches.push(batch.commit());
    }
    await Promise.all(batches);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
};

export const getSettings = async (): Promise<UserSettings> => {
  if (!auth.currentUser) return { apiKey: '', defaultQuestions: 10, defaultCriteria: ['Meaning', 'Word Type', 'Synonyms'] };
  const path = `users/${auth.currentUser.uid}/settings`;
  try {
    const snapshot = await getDocs(collection(db, path));
    if (snapshot.empty) return { apiKey: '', defaultQuestions: 10, defaultCriteria: ['Meaning', 'Word Type', 'Synonyms'] };
    return snapshot.docs[0].data() as UserSettings;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return { apiKey: '', defaultQuestions: 10, defaultCriteria: ['Meaning', 'Word Type', 'Synonyms'] };
  }
};

export const saveSettings = async (settings: UserSettings) => {
  if (!auth.currentUser) return;
  const path = `users/${auth.currentUser.uid}/settings`;
  try {
    settings.ownerId = auth.currentUser.uid;
    await setDoc(doc(db, path, 'default'), settings);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const getQuizSessions = async (): Promise<QuizSession[]> => {
  if (!auth.currentUser) return [];
  const path = `users/${auth.currentUser.uid}/quizSessions`;
  try {
    const snapshot = await getDocs(collection(db, path));
    return snapshot.docs.map(doc => doc.data() as QuizSession);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return [];
  }
};

export const saveQuizSession = async (session: QuizSession) => {
  if (!auth.currentUser) return;
  const path = `users/${auth.currentUser.uid}/quizSessions`;
  try {
    session.ownerId = auth.currentUser.uid;
    await setDoc(doc(db, path, session.id), session);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};
