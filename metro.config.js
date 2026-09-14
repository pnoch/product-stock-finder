const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const fs = require("fs");
const path = require("path");
const { resolveBrowserModulePath } = require("./scripts/metro-resolver");

const config = getDefaultConfig(__dirname);

// NativeWind's `forceWriteFileSystem` writes the generated CSS into
// node_modules/react-native-css-interop/.cache/ during transform, but Metro
// only hashes files it saw during its initial crawl. On a clean install
// (CI/Railway, no stale cache file) the web export therefore fails with
// "Failed to get the SHA-1 for .../web.css". Pre-creating the file (as the
// interop package already does for the native platform stubs) puts it in the
// crawl; the transformer then overwrites it with the real CSS.
const cssInteropCache = path.resolve(
  __dirname,
  "node_modules/react-native-css-interop/.cache",
);
fs.mkdirSync(cssInteropCache, { recursive: true });
const webCss = path.join(cssInteropCache, "web.css");
if (!fs.existsSync(webCss)) fs.writeFileSync(webCss, "");

config.watchFolders = [...(config.watchFolders ?? []), cssInteropCache];

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const redirected = resolveBrowserModulePath(platform, moduleName, context.originModulePath);
  if (redirected) {
    return { type: "sourceFile", filePath: redirected };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, {
  input: "./global.css",
  // Force write CSS to file system instead of virtual modules
  // This fixes iOS styling issues in development mode
  forceWriteFileSystem: true,
});
