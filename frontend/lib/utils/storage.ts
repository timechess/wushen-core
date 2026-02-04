/// 本地存储工具函数（用于自动保存草稿）

const STORAGE_PREFIX = "wushen_editor_draft_";

/**
 * 保存草稿到 localStorage
 */
export function saveDraft(key: string, data: any): void {
  try {
    const storageKey = `${STORAGE_PREFIX}${key}`;
    const jsonData = JSON.stringify(data);
    localStorage.setItem(storageKey, jsonData);
  } catch (error) {
    console.error("保存草稿失败:", error);
  }
}

/**
 * 从 localStorage 加载草稿
 */
export function loadDraft<T>(key: string): T | null {
  try {
    const storageKey = `${STORAGE_PREFIX}${key}`;
    const jsonData = localStorage.getItem(storageKey);
    if (!jsonData) return null;
    return JSON.parse(jsonData) as T;
  } catch (error) {
    console.error("加载草稿失败:", error);
    return null;
  }
}

/**
 * 清除草稿
 */
export function clearDraft(key: string): void {
  try {
    const storageKey = `${STORAGE_PREFIX}${key}`;
    localStorage.removeItem(storageKey);
  } catch (error) {
    console.error("清除草稿失败:", error);
  }
}

/**
 * 检查是否有草稿
 */
export function hasDraft(key: string): boolean {
  try {
    const storageKey = `${STORAGE_PREFIX}${key}`;
    return localStorage.getItem(storageKey) !== null;
  } catch (error) {
    return false;
  }
}
