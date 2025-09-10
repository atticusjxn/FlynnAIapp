const { getDefaultConfig } = require("@expo/metro-config")

module.exports = (() => {
  const config = getDefaultConfig(__dirname)
  
  config.transformer.assetPlugins = ['expo-asset/tools/hashAssetFiles']
  
  return config
})()