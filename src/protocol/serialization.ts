/**
 * Canonical payload format for signatures:
 * - UTF-8 JSON
 * - object keys sorted lexicographically at every depth
 * - arrays preserve order
 * - no whitespace
 * - protocol binary fields use unpadded Base64URL strings
 */
function sortObject(obj: any): any {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(sortObject);
  }
  
  const sortedKeys = Object.keys(obj).sort();
  const sortedObj: any = {};
  
  for (const key of sortedKeys) {
    sortedObj[key] = sortObject(obj[key]);
  }
  
  return sortedObj;
}

export function canonicalize(obj: any): string {
  return JSON.stringify(sortObject(obj));
}

export function serializeForSigning(payload: any): string {
  return canonicalize(payload);
}
