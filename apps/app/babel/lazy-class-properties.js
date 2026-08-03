/**
 * Path-aware lazy wrapper around `@babel/plugin-proposal-class-properties`.
 *
 * Hermes V1 (Expo SDK 57 / RN 0.86) drops class-properties from the engine
 * preset, so WatermelonDB legacy decorators still need the plugin
 * (expo/expo#47722). Enabling it *globally* also forces Babel to transform
 * private methods (`#foo`) in react-native sources such as
 * `GlobalStateObserver.js`, which then fails with:
 *   Class private methods are not enabled
 *
 * Only run the transform for our app models and WatermelonDB itself. Leave
 * other node_modules (including RN) on native class fields / private methods.
 * A plain `/@\w/` heuristic is not enough — RN headers contain `@flow`.
 */

'use strict';

const path = require('node:path');
const { createRequire } = require('node:module');

// Resolve the already-declared app dep from apps/app/package.json, not from
// whatever cwd Metro happened to start in.
const requireFromApp = createRequire(path.join(__dirname, '..', 'package.json'));

const DECORATOR_PATTERN = /@\w/;

function isLocusDecoratedSource(filename) {
  if (!filename) return false;
  const normalized = filename.replace(/\\/g, '/');
  return (
    normalized.includes('/apps/app/') ||
    normalized.includes('/@nozbe/watermelondb/')
  );
}

module.exports = function locusLazyClassProperties(api, options) {
  const factory = requireFromApp('@babel/plugin-proposal-class-properties');
  const realPlugin = (factory.default ?? factory)(api, options);
  const visitor = {};

  for (const [key, value] of Object.entries(realPlugin.visitor || {})) {
    if (typeof value === 'function') {
      const fn = value;
      visitor[key] = function (path, state) {
        if (!state.classPropertiesActive) return;
        return fn.call(this, path, state);
      };
    } else if (value && typeof value === 'object') {
      const wrapped = {};
      for (const hook of ['enter', 'exit']) {
        if (value[hook]) {
          const h = value[hook];
          wrapped[hook] = function (path, state) {
            if (!state.classPropertiesActive) return;
            return h.call(this, path, state);
          };
        }
      }
      visitor[key] = wrapped;
    }
  }

  return {
    name: 'locus-lazy-class-properties',
    inherits: realPlugin.inherits,
    pre(file) {
      const filename = file.opts.filename || '';
      this.classPropertiesActive =
        isLocusDecoratedSource(filename) && DECORATOR_PATTERN.test(file.code);
      if (this.classPropertiesActive && realPlugin.pre) {
        realPlugin.pre.call(this, file);
      }
    },
    visitor,
    post(file) {
      if (this.classPropertiesActive && realPlugin.post) {
        realPlugin.post.call(this, file);
      }
    },
  };
};
