const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Custom resolver to redirect 'zod/v4' imports to 'zod'
config.resolver = config.resolver || {};
const originalResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Intercept imports of 'zod/v4' and redirect to 'zod'
  if (moduleName === "zod/v4") {
    return context.resolveRequest(context, "zod", platform);
  }

  // Use the original resolver for all other imports
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
