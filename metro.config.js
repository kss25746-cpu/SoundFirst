const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// SVG를 React 컴포넌트로 import 할 수 있도록 설정
config.transformer.babelTransformerPath = require.resolve('react-native-svg-transformer/expo');
config.resolver.assetExts = config.resolver.assetExts.filter((ext) => ext !== 'svg');
config.resolver.sourceExts = [...config.resolver.sourceExts, 'svg'];

// .riv 파일을 asset으로 인식하도록 추가
config.resolver.assetExts.push('riv');
// .flac 오디오를 asset으로 인식
config.resolver.assetExts.push('flac');

module.exports = config;

