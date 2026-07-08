/**
 * index.js
 *
 * WHY THIS FILE EXISTS:
 * This is the very first JavaScript file the React Native Metro bundler looks
 * for when building the app. It registers the root App component with the
 * Android/iOS runtime using AppRegistry.
 *
 * 'ASHAShield' must match the applicationId in android/app/build.gradle.
 */

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

// registerComponent tells the native runtime which React component is the
// root of the app — the equivalent of index.html's <div id="root"> in web React.
AppRegistry.registerComponent(appName, () => App);
