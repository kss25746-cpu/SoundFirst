// babel.config.js (Reanimated 적용)
module.exports = function(api) {
    api.cache(true);
    return {
      presets: ['babel-preset-expo'],
      plugins: [
        // 1. 여기에 다른 플러그인이 있다면 넣으세요.
        // 예: '@babel/plugin-transform-runtime' 등
        
        // 2. reanimated 플러그인은 반드시 'plugins' 배열의 맨 마지막에 위치해야 합니다!
        'react-native-reanimated/plugin', 
      ],
    };
  };