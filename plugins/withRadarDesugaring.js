const { withAppBuildGradle } = require("@expo/config-plugins");

const DESUGAR_DEP =
  "coreLibraryDesugaring 'com.android.tools:desugar_jdk_libs:2.1.5'";

const withRadarDesugaring = (config) => {
  return withAppBuildGradle(config, (config) => {
    const { modResults } = config;
    let contents = modResults.contents;

    // Ensure compileOptions contains coreLibraryDesugaringEnabled
    if (!contents.includes("coreLibraryDesugaringEnabled")) {
      const compileOptionsBlock = /compileOptions\s*\{[\s\S]*?\}/;

      if (compileOptionsBlock.test(contents)) {
        contents = contents.replace(compileOptionsBlock, (block) => {
          if (block.includes("coreLibraryDesugaringEnabled")) {
            return block;
          }
          const closing = block.lastIndexOf("}");
          return (
            block.slice(0, closing) +
            "\n        coreLibraryDesugaringEnabled true\n    }"
          );
        });
      } else {
        contents = contents.replace(
          /android\s*\{/,
          "android {\n    compileOptions {\n        coreLibraryDesugaringEnabled true\n        sourceCompatibility JavaVersion.VERSION_11\n        targetCompatibility JavaVersion.VERSION_11\n    }",
        );
      }
    }

    // Ensure desugar dependency is present and correct
    if (!contents.includes("desugar_jdk_libs")) {
      contents = contents.replace(
        /dependencies\s*\{/,
        `dependencies {\n    ${DESUGAR_DEP}`,
      );
    } else if (!contents.includes("desugar_jdk_libs:2.1.5")) {
      contents = contents.replace(
        /coreLibraryDesugaring\s+['"]com\.android\.tools:desugar_jdk_libs:[^'"]+['"]/,
        DESUGAR_DEP,
      );
    }

    modResults.contents = contents;
    return config;
  });
};

module.exports = withRadarDesugaring;
