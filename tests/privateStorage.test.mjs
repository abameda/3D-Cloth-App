import test from 'node:test';
import assert from 'node:assert/strict';
import plugin from '../plugins/with-private-captures.cjs';

test('iPhone document storage excludes personal captures from OS backup at launch',()=>{
 const source='import Expo\nclass AppDelegate: ExpoAppDelegate {\n override func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {\n return true\n }\n}';
 const changed=plugin.protectDocuments(source,'swift');
 assert.match(changed,/isExcludedFromBackup = true/);assert.match(changed,/FileProtectionType.complete/);
 assert.equal(plugin.protectDocuments(changed,'swift'),changed);
 assert.throws(()=>plugin.protectDocuments('unknown delegate','swift'));
});
