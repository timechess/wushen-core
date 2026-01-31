import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');

export function getDataDir(): string {
  return DATA_DIR;
}

function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function resolveDataDir(baseDir?: string): string {
  return baseDir ?? DATA_DIR;
}

function readFileSafe(filePath: string): string | null {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return fs.readFileSync(filePath, 'utf-8');
}

export function readCollection<T>(fileName: string, key?: string, baseDir?: string): T[] {
  const dir = resolveDataDir(baseDir);
  ensureDir(dir);
  const filePath = path.join(dir, fileName);
  const content = readFileSafe(filePath);
  if (!content) {
    return [];
  }

  const data = JSON.parse(content);
  if (Array.isArray(data)) {
    return data as T[];
  }
  if (key && data && Array.isArray(data[key])) {
    return data[key] as T[];
  }
  return [];
}

export function writeCollection<T>(fileName: string, items: T[], key?: string, baseDir?: string): void {
  const dir = resolveDataDir(baseDir);
  ensureDir(dir);
  const filePath = path.join(dir, fileName);
  const payload = key ? { [key]: items } : items;
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf-8');
}

export function readJson<T>(fileName: string, fallback: T, baseDir?: string): T {
  const dir = resolveDataDir(baseDir);
  ensureDir(dir);
  const filePath = path.join(dir, fileName);
  const content = readFileSafe(filePath);
  if (!content) {
    return fallback;
  }
  try {
    return JSON.parse(content) as T;
  } catch {
    return fallback;
  }
}

export function writeJson<T>(fileName: string, data: T, baseDir?: string): void {
  const dir = resolveDataDir(baseDir);
  ensureDir(dir);
  const filePath = path.join(dir, fileName);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}
