export interface ModPackMetadata {
  id: string;
  name: string;
  version: string;
  author?: string;
  description?: string;
  created_at: string;
  updated_at?: string;
}

export interface ActivePack {
  id: string;
  name: string;
  version: string;
  author?: string;
}

export interface ModPackManifest {
  id: string;
  name: string;
  version: string;
  author?: string;
  description?: string;
  files: string[];
}
