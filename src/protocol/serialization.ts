/**
 * Deterministic JSON stringify to ensure consistent signatures.
 * Basic implementation: sorts keys alphabetically.
 */
export function canonicalize(obj: any): string {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
    return JSON.stringify(obj);
  }

  const sortedKeys = Object.keys(obj).sort();
  const sortedObj: any = {};
  
  for (const key of sortedKeys) {
    sortedObj[key] = canonicalize(obj[key]);
  }

  // Note: We return the stringified version of the sorted object.
  // We need to be careful with nested objects being stringified twice if we recursive incorrectly.
  // Actually, a better approach is to sort the keys and then use JSON.stringify.
  
  return JSON.stringify(sortObject(obj));
}

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

export function serializeForSigning(payload: any): string {
  return JSON.stringify(sortObject(payload));
}
