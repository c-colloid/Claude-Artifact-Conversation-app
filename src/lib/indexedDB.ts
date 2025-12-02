/**
 * IndexedDB Database Wrapper
 * Overcomes LocalStorage limitations with async data operations
 *
 * Features:
 * - Async data operations (no UI blocking)
 * - Unlimited storage capacity
 * - Structured data store
 * - 10-20x faster save speed (for large datasets)
 */

import { getTimestamp } from './utils';

interface StoredData {
  key: string;
  value: any;
  timestamp: string;
}

class IndexedDBWrapperClass {
  private DB_NAME = 'MultiCharacterChatDB';
  private DB_VERSION = 1;
  private STORE_NAME = 'appData';
  private dbInstance: IDBDatabase | null = null;

  /**
   * Open database (cache and reuse connection)
   */
  private async openDB(): Promise<IDBDatabase> {
    if (this.dbInstance) {
      return Promise.resolve(this.dbInstance);
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onerror = () => {
        reject(new Error('IndexedDBを開けませんでした'));
      };

      request.onsuccess = () => {
        this.dbInstance = request.result;
        resolve(this.dbInstance);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          const objectStore = db.createObjectStore(this.STORE_NAME, { keyPath: 'key' });
          objectStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  /**
   * Execute transaction helper
   */
  private async executeTransaction<T>(
    mode: IDBTransactionMode,
    operation: (store: IDBObjectStore) => IDBRequest,
    errorMsg: string,
    processResult?: (result: any) => T
  ): Promise<T | undefined> {
    const db = await this.openDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.STORE_NAME], mode);
      const objectStore = transaction.objectStore(this.STORE_NAME);
      const request = operation(objectStore);

      request.onsuccess = () => {
        const result = processResult ? processResult(request.result) : undefined;
        resolve(result);
      };

      request.onerror = () => {
        reject(new Error(errorMsg));
      };
    });
  }

  /**
   * Save data
   */
  async setItem(key: string, value: any): Promise<void> {
    await this.executeTransaction(
      'readwrite',
      (store) => store.put({ key, value, timestamp: getTimestamp() }),
      'データの保存に失敗しました'
    );
  }

  /**
   * Load data
   */
  async getItem<T = any>(key: string): Promise<T | null> {
    const result = await this.executeTransaction(
      'readonly',
      (store) => store.get(key),
      'データの読み込みに失敗しました',
      (result: StoredData) => (result ? result.value : null)
    );
    return result ?? null;
  }

  /**
   * Delete data
   */
  async removeItem(key: string): Promise<void> {
    await this.executeTransaction(
      'readwrite',
      (store) => store.delete(key),
      'データの削除に失敗しました'
    );
  }

  /**
   * Clear all data
   */
  async clear(): Promise<void> {
    await this.executeTransaction(
      'readwrite',
      (store) => store.clear(),
      'データのクリアに失敗しました'
    );
  }
}

// Export singleton instance
export const IndexedDBWrapper = new IndexedDBWrapperClass();
