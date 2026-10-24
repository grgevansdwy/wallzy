const isEasBuild = !!process.env.EAS_BUILD;

module.exports = ({ config }) => ({
  ...config,
  updates: isEasBuild
    ? { url: "https://u.expo.dev/fe6a59ed-db0a-4138-ae26-8aa2c6652301" }
    : { enabled: false },
  runtimeVersion: isEasBuild ? { policy: "appVersion" } : undefined,
});
