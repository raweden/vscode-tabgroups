
// use 'rollup -c config.display-server.mjs' to bundle all dependencies
export default {
    input: "src/extension.js",
    output: {
        file: "out/extension.js",
        format: "cjs"
    }
};
