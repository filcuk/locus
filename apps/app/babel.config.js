module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Babel 7 API — `{ legacy: true }`. Do not use @babel/plugin-proposal-decorators@8
      // here: it pulls @babel/types@8 and breaks react-native-worklets on web.
      ['@babel/plugin-proposal-decorators', { legacy: true }],
      ['@babel/plugin-proposal-class-properties', { loose: true }],
      'react-native-reanimated/plugin',
    ],
  };
};
