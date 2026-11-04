const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// inlineRem 16 : `h-12` = 48 dp comme dans le design system (NativeWind convertit 1rem en 14 dp par défaut, issue 0012).
module.exports = withNativeWind(config, { input: "./global.css", inlineRem: 16 });
