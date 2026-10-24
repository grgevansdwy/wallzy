module.exports = function (api) {
  api.cache(true);
  return {
    presets: [["babel-preset-expo", { unstable_transformImportMeta: true }]],
    plugins: [
      [
        "module-resolver",
        {
          alias: {
            // Some packages (like @rork-ai/toolkit-sdk) import from 'zod/v4'.
            // Alias it to the installed 'zod' package so Metro can resolve it.
            "zod/v4": "zod",
          },
        },
      ],
    ],
  };
};
