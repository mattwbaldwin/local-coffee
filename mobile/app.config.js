export default {
  expo: {
    name: 'Local Coffee',
    slug: 'local-coffee',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'dark',
    scheme: 'localcoffee',
    splash: {
      image: './assets/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#141414',
    },
    assetBundlePatterns: ['**/*'],
    ios: {
      supportsTablet: false,
      bundleIdentifier: 'com.localcoffee.app',
      infoPlist: {
        NSLocationWhenInUseUsageDescription:
          'Local Coffee uses your location to find independent coffee shops nearby.',
        NSLocationAlwaysAndWhenInUseUsageDescription:
          'Local Coffee uses your location to find independent coffee shops nearby.',
      },
      config: {
        googleMapsApiKey: process.env.GOOGLE_MAPS_IOS_SDK_KEY ?? '',
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#141414',
      },
      package: 'com.localcoffee.app',
      permissions: [
        'android.permission.ACCESS_FINE_LOCATION',
        'android.permission.ACCESS_COARSE_LOCATION',
      ],
      config: {
        googleMaps: {
          apiKey: process.env.GOOGLE_MAPS_ANDROID_SDK_KEY ?? '',
        },
      },
    },
    plugins: [
      'expo-router',
      'expo-location',
    ],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:3000',
    },
  },
};
