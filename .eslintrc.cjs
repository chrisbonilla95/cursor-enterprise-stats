const { tsOverride } = require("@gooddata/eslint-config/tsOverride");

module.exports = {
    extends: ["@gooddata/eslint-config/esm"],
    rules: {
        // Disable header requirement - this is not a GoodData project
        "header/header": "off",
    },
    overrides: [tsOverride(__dirname)],
};

