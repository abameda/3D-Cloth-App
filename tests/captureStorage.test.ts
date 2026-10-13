import test from 'node:test';
import assert from 'node:assert/strict';
import {captureStoragePolicy} from '../src/domain/captureStorage';

test('Expo Go uses non-backup cache for personal captures; installed native apps keep protected documents',()=>{
 assert.equal(captureStoragePolicy('storeClient'),'cache');
 assert.equal(captureStoragePolicy('standalone'),'documents');
 assert.equal(captureStoragePolicy('bare'),'documents');
});
