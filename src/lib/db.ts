import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Topic, Product, GeneratedScript } from './types';

const DB_NAME = 'video-script-agent';
const DB_VERSION = 1;

interface VideoScriptDB extends DBSchema {
  topics: {
    key: string;
    value: Topic;
    indexes: { awemeId: string };
  };
  products: {
    key: string;
    value: Product;
  };
  scripts: {
    key: string;
    value: GeneratedScript;
  };
}

let dbPromise: Promise<IDBPDatabase<VideoScriptDB>> | null = null;

export function getDB() {
  if (typeof window === 'undefined') {
    throw new Error('IndexedDB is only available in the browser');
  }
  if (!dbPromise) {
    dbPromise = openDB<VideoScriptDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const topicStore = db.createObjectStore('topics', { keyPath: 'id' });
        topicStore.createIndex('awemeId', 'awemeId', { unique: true });

        db.createObjectStore('products', { keyPath: 'id' });
        db.createObjectStore('scripts', { keyPath: 'id' });
      },
    });
  }
  return dbPromise;
}

export async function getTopics(): Promise<Topic[]> {
  const db = await getDB();
  return db.getAll('topics');
}

export async function getTopic(id: string): Promise<Topic | undefined> {
  const db = await getDB();
  return db.get('topics', id);
}

export async function getTopicByAwemeId(awemeId: string): Promise<Topic | undefined> {
  const db = await getDB();
  return db.getFromIndex('topics', 'awemeId', awemeId);
}

export async function saveTopic(topic: Topic): Promise<Topic> {
  const db = await getDB();
  const existing = await db.getFromIndex('topics', 'awemeId', topic.awemeId);
  if (existing) {
    await db.put('topics', { ...topic, id: existing.id });
    return { ...topic, id: existing.id };
  }
  await db.put('topics', topic);
  return topic;
}

export async function saveTopics(topics: Topic[]): Promise<Topic[]> {
  return Promise.all(topics.map((t) => saveTopic(t)));
}

export async function deleteTopic(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('topics', id);
}

export async function getProducts(): Promise<Product[]> {
  const db = await getDB();
  return db.getAll('products');
}

export async function getProduct(id: string): Promise<Product | undefined> {
  const db = await getDB();
  return db.get('products', id);
}

export async function saveProduct(product: Product): Promise<Product> {
  const db = await getDB();
  await db.put('products', product);
  return product;
}

export async function deleteProduct(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('products', id);
}

export async function getScripts(): Promise<GeneratedScript[]> {
  const db = await getDB();
  return db.getAll('scripts');
}

export async function getScript(id: string): Promise<GeneratedScript | undefined> {
  const db = await getDB();
  return db.get('scripts', id);
}

export async function saveScript(script: GeneratedScript): Promise<GeneratedScript> {
  const db = await getDB();
  await db.put('scripts', script);
  return script;
}

export async function saveScripts(scripts: GeneratedScript[]): Promise<GeneratedScript[]> {
  return Promise.all(scripts.map((s) => saveScript(s)));
}

export async function deleteScript(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('scripts', id);
}

export async function clearAllStores(): Promise<void> {
  const db = await getDB();
  await Promise.all([
    db.clear('topics'),
    db.clear('products'),
    db.clear('scripts'),
  ]);
}
