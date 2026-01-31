export const PACK_DATA_FILES = [
  { file: 'traits.json', key: 'traits' },
  { file: 'internals.json', key: 'internals' },
  { file: 'attack_skills.json', key: 'attack_skills' },
  { file: 'defense_skills.json', key: 'defense_skills' },
  { file: 'adventures.json', key: 'adventures' },
  { file: 'storylines.json', key: 'storylines' },
] as const;

export type PackDataFile = (typeof PACK_DATA_FILES)[number];

export function defaultPackFileNames(): string[] {
  return PACK_DATA_FILES.map((item) => item.file);
}
