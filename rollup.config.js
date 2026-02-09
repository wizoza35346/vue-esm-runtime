import terser from '@rollup/plugin-terser';
import resolve from '@rollup/plugin-node-resolve';

const banner = `/**
 * vue-esm-runtime.js
 * Browser ES Module loader for Vue SFC
 * Supports Vue 2.7+ and Vue 3
 */`;

const nativeBanner = `/**
 * vue-esm-runtime-native.js
 * Native compiler plugin using @vue/compiler-sfc
 * Optional: loaded automatically when mini compiler fails
 */`;

export default [
  // UMD build (for browsers)
  {
    input: 'src/index.js',
    output: {
      file: 'dist/vue-esm-runtime.js',
      format: 'umd',
      name: 'vueEsmRuntime',
      banner,
      exports: 'default'
    },
    plugins: [resolve({ browser: true })]
  },
  // UMD minified
  {
    input: 'src/index.js',
    output: {
      file: 'dist/vue-esm-runtime.min.js',
      format: 'umd',
      name: 'vueEsmRuntime',
      banner,
      exports: 'default'
    },
    plugins: [resolve({ browser: true }), terser()]
  },
  // ESM build
  {
    input: 'src/index.js',
    output: {
      file: 'dist/vue-esm-runtime.esm.js',
      format: 'es',
      banner
    },
    plugins: [resolve({ browser: true })]
  },
  // Native compiler plugin (ESM)
  {
    input: 'src/vue-esm-runtime-native.js',
    output: {
      file: 'dist/vue-esm-runtime-native.js',
      format: 'es',
      banner: nativeBanner
    },
    plugins: [resolve({ browser: true })]
  },
  // Native compiler plugin (ESM minified)
  {
    input: 'src/vue-esm-runtime-native.js',
    output: {
      file: 'dist/vue-esm-runtime-native.min.js',
      format: 'es',
      banner: nativeBanner
    },
    plugins: [resolve({ browser: true }), terser()]
  }
];
