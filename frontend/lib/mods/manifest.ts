import toml from '@iarna/toml';
import type { ModPackManifest, ModPackMetadata } from '@/types/mod';
import { defaultPackFileNames } from '@/lib/mods/pack-files';

export function buildManifest(pack: ModPackMetadata, files?: string[]): ModPackManifest {
  return {
    id: pack.id,
    name: pack.name,
    version: pack.version,
    author: pack.author,
    description: pack.description,
    files: files && files.length > 0 ? files : defaultPackFileNames(),
  };
}

export function manifestToToml(manifest: ModPackManifest): string {
  return toml.stringify({
    id: manifest.id,
    name: manifest.name,
    version: manifest.version,
    author: manifest.author ?? '',
    description: manifest.description ?? '',
    files: manifest.files,
  });
}

export function parseManifestToml(source: string): ModPackManifest {
  const data = toml.parse(source) as Partial<ModPackManifest> & { files?: string[] };
  if (!data.id || !data.name || !data.version) {
    throw new Error('metadata.toml 缺少必要字段（id/name/version）');
  }
  return {
    id: data.id,
    name: data.name,
    version: data.version,
    author: data.author,
    description: data.description,
    files: data.files && data.files.length > 0 ? data.files : defaultPackFileNames(),
  };
}
