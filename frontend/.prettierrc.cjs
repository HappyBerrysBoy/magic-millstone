// .prettierrc.cjs
module.exports = {
  semi: true,
  singleQuote: false,
  tabWidth: 2,
  trailingComma: "all",
  pluginSearchDirs: ["."],
  plugins: [require.resolve("prettier-plugin-tailwindcss")],
};
