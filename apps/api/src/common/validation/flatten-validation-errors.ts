import type { ValidationError } from 'class-validator';

// class-validator reports nested-object/array errors (e.g. @ValidateNested on
// CreateContractDto.boqItems) as a tree via ValidationError.children rather
// than populating .constraints on the parent — so a naive top-level-only walk
// silently drops every nested error message. This flattens the whole tree
// into "path.to.field" -> messages, e.g. "boqItems.0.unitPrice".
export function flattenValidationErrors(
  errors: ValidationError[],
  parentPath = '',
): Record<string, string[]> {
  const fields: Record<string, string[]> = {};

  for (const err of errors) {
    if (!err.property) continue;
    const path = parentPath ? `${parentPath}.${err.property}` : err.property;

    if (err.constraints) {
      fields[path] = [...(fields[path] ?? []), ...Object.values(err.constraints)];
    }

    if (err.children && err.children.length > 0) {
      const nested = flattenValidationErrors(err.children, path);
      for (const [key, messages] of Object.entries(nested)) {
        fields[key] = [...(fields[key] ?? []), ...messages];
      }
    }
  }

  return fields;
}
