module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Babel 7 API — `{ legacy: true }`. Do not use @babel/plugin-proposal-decorators@8
      // here: it pulls @babel/types@8 and breaks react-native-worklets on web.
      ['@babel/plugin-proposal-decorators', { legacy: true }],
      // Scoped class-properties for WatermelonDB / Hermes V1 — see babel/lazy-class-properties.js
      // and expo/expo#47722. Do not enable class-properties globally (breaks RN #private methods).
      ['./babel/lazy-class-properties.js', { loose: true }],
      'react-native-reanimated/plugin',
    ],
  };
};
