/** Expo Go cannot apply our native backup-exclusion plugin. iOS caches are excluded from device backups. */
export function captureStoragePolicy(executionEnvironment:string){
 return executionEnvironment==='storeClient'?'cache':'documents';
}
