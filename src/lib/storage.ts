import { VocabItem, UserSettings, QuizSession, CollocationItem } from "../types";
import { db, auth } from "./firebase";
import { collection, doc, getDocs, setDoc, writeBatch } from "firebase/firestore";

const DEFAULT_SETTINGS: UserSettings = {
  apiKey: '',
  defaultQuestions: 10,
  defaultCriteria: ['Meaning', 'Word Type', 'Synonyms'],
};
const LOCAL_API_KEY_STORAGE_KEY = 'uyenuyen-gemini-api-key';

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

function getLocalApiKey() {
  try {
    return localStorage.getItem(LOCAL_API_KEY_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

function saveLocalApiKey(apiKey?: string) {
  try {
    const trimmedKey = apiKey?.trim() || '';
    if (trimmedKey) {
      localStorage.setItem(LOCAL_API_KEY_STORAGE_KEY, trimmedKey);
    } else {
      localStorage.removeItem(LOCAL_API_KEY_STORAGE_KEY);
    }
  } catch {
    // Local API key storage is browser-only. Ignore storage errors.
  }
}

function withLocalApiKey(settings?: Partial<UserSettings>): UserSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...settings,
    apiKey: getLocalApiKey(),
  };
}

function withoutApiKey(settings: UserSettings): Omit<UserSettings, 'apiKey'> {
  const { apiKey, ...settingsWithoutApiKey } = settings;
  return settingsWithoutApiKey;
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

async function getUserCollection<T>(collectionName: string): Promise<T[]> {
  if (!auth.currentUser) return [];
  const path = `users/${auth.currentUser.uid}/${collectionName}`;
  try {
    const snapshot = await getDocs(collection(db, path));
    return snapshot.docs.map(doc => doc.data() as T);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return [];
  }
}

async function saveUserCollection<T extends { id: string; ownerId?: string }>(collectionName: string, records: T[]) {
  if (!auth.currentUser) return;
  const path = `users/${auth.currentUser.uid}/${collectionName}`;
  try {
    const batches = [];
    let batch = writeBatch(db);
    let count = 0;
    records.forEach(record => {
      record.ownerId = auth.currentUser!.uid;
      const docRef = doc(db, path, record.id);
      batch.set(docRef, record);
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
}

async function deleteUserCollectionRecords(collectionName: string, ids: string[]) {
  if (!auth.currentUser) return;
  const path = `users/${auth.currentUser.uid}/${collectionName}`;
  try {
    const batches = [];
    let batch = writeBatch(db);
    let count = 0;
    ids.forEach(id => {
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
}

export const getVocabItems = async (): Promise<VocabItem[]> => {
  return getUserCollection<VocabItem>('vocabItems');
};

export const saveVocabItems = async (items: VocabItem[]) => {
  await saveUserCollection('vocabItems', items);
};

export const deleteVocabItems = async (itemIds: string[]) => {
  await deleteUserCollectionRecords('vocabItems', itemIds);
};

export const getCollocationItems = async (): Promise<CollocationItem[]> => {
  return getUserCollection<CollocationItem>('collocations');
};

export const saveCollocationItems = async (items: CollocationItem[]) => {
  await saveUserCollection('collocations', items);
};

export const deleteCollocationItems = async (itemIds: string[]) => {
  await deleteUserCollectionRecords('collocations', itemIds);
};

export const getSettings = async (): Promise<UserSettings> => {
  if (!auth.currentUser) return withLocalApiKey();
  const path = `users/${auth.currentUser.uid}/settings`;
  try {
    const snapshot = await getDocs(collection(db, path));
    if (snapshot.empty) return withLocalApiKey();
    return withLocalApiKey(snapshot.docs[0].data() as Partial<UserSettings>);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return withLocalApiKey();
  }
};

export const saveSettings = async (settings: UserSettings) => {
  if (!auth.currentUser) return;
  const path = `users/${auth.currentUser.uid}/settings`;
  try {
    saveLocalApiKey(settings.apiKey);
    const settingsForFirestore = withoutApiKey({
      ...settings,
      ownerId: auth.currentUser.uid,
    });
    await setDoc(doc(db, path, 'default'), settingsForFirestore);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const getQuizSessions = async (): Promise<QuizSession[]> => {
  return getUserCollection<QuizSession>('quizSessions');
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
