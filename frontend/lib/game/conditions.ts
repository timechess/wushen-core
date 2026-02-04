import type { Character } from "@/types/character";
import type { Condition, ComparisonOp } from "@/types/trait";
import type { Internal, AttackSkill, DefenseSkill } from "@/types/manual";

export interface ManualMaps {
  internals: Record<string, Internal>;
  attackSkills: Record<string, AttackSkill>;
  defenseSkills: Record<string, DefenseSkill>;
}

function compare(op: ComparisonOp, left: number, right: number): boolean {
  switch (op) {
    case "less_than":
      return left < right;
    case "less_than_or_equal":
      return left <= right;
    case "equal":
      return left === right;
    case "greater_than":
      return left > right;
    case "greater_than_or_equal":
      return left >= right;
    default:
      return false;
  }
}

export function isConditionMet(
  condition: Condition | null | undefined,
  character: Character,
  manuals: ManualMaps,
): boolean {
  if (!condition) return true;

  if ("and" in condition) {
    return condition.and.every((item) =>
      isConditionMet(item, character, manuals),
    );
  }
  if ("or" in condition) {
    return condition.or.some((item) =>
      isConditionMet(item, character, manuals),
    );
  }

  const internalId = character.internals.equipped ?? null;
  const attackId = character.attack_skills.equipped ?? null;
  const defenseId = character.defense_skills.equipped ?? null;

  const internalType = internalId
    ? (manuals.internals[internalId]?.manual_type ?? null)
    : null;
  const attackType = attackId
    ? (manuals.attackSkills[attackId]?.manual_type ?? null)
    : null;
  const defenseType = defenseId
    ? (manuals.defenseSkills[defenseId]?.manual_type ?? null)
    : null;

  if ("internal_is" in condition) {
    return internalId === condition.internal_is;
  }
  if ("internal_type_is" in condition) {
    return internalType === condition.internal_type_is;
  }
  if ("attack_skill_is" in condition) {
    return attackId === condition.attack_skill_is;
  }
  if ("attack_skill_type_is" in condition) {
    return attackType === condition.attack_skill_type_is;
  }
  if ("defense_skill_is" in condition) {
    return defenseId === condition.defense_skill_is;
  }
  if ("defense_skill_type_is" in condition) {
    return defenseType === condition.defense_skill_type_is;
  }
  if ("has_trait" in condition) {
    return character.traits.includes(condition.has_trait);
  }
  if ("attribute_comparison" in condition) {
    const { attribute, op, value } = condition.attribute_comparison;
    const current =
      attribute === "comprehension"
        ? character.three_d.comprehension
        : attribute === "bone_structure"
          ? character.three_d.bone_structure
          : attribute === "physique"
            ? character.three_d.physique
            : (character.martial_arts_attainment ?? 0);
    return compare(op, current, value);
  }

  return false;
}
