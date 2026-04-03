/**
 * Config plugin that patches the generated Podfile to set C++17 on the fmt
 * pod, fixing "call to consteval function is not a constant expression" errors
 * when building with Xcode 16+ / iOS 26 SDK.
 */
const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

module.exports = function withFmtFix(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(
        config.modRequest.platformProjectRoot,
        'Podfile'
      );

      let podfile = fs.readFileSync(podfilePath, 'utf8');

      const fix = `
  # Fix: fmt consteval incompatibility with Xcode 16+ / iOS 26 Clang
  installer.pods_project.targets.each do |target|
    if target.name == 'fmt'
      target.build_configurations.each do |build_config|
        build_config.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'c++17'
      end
    end
  end
`;

      if (!podfile.includes('CLANG_CXX_LANGUAGE_STANDARD')) {
        podfile = podfile.replace(
          'post_install do |installer|',
          'post_install do |installer|' + fix
        );
        fs.writeFileSync(podfilePath, podfile);
      }

      return config;
    },
  ]);
};
