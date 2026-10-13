const { withAppDelegate } = require('@expo/config-plugins');
const marker = '// Thread private photo storage';

function protectDocuments(source, language) {
 if (source.includes(marker)) return source;
 if (language !== 'swift') throw Error('Thread privacy setup requires the Swift Expo AppDelegate.');
 const launch = /(didFinishLaunchingWithOptions[\s\S]*?\)\s*->\s*Bool\s*\{)/;
 if (!launch.test(source)) throw Error('Cannot locate AppDelegate launch method to protect Thread photos.');
 return source.replace(launch,`$1
    ${marker}
    // A directory exclusion covers its descendants, including future capture files.
    do {
      var documents = try FileManager.default.url(for: .documentDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
      var values = URLResourceValues()
      values.isExcludedFromBackup = true
      try documents.setResourceValues(values)
      try FileManager.default.setAttributes([.protectionKey: FileProtectionType.complete], ofItemAtPath: documents.path)
    } catch {
      // Do not launch capture workflows when private storage protection failed.
      fatalError("Thread could not protect private app storage")
    }
`);
}

module.exports = config => withAppDelegate(config, result => {
 result.modResults.contents = protectDocuments(result.modResults.contents, result.modResults.language);
 return result;
});
module.exports.protectDocuments = protectDocuments;
