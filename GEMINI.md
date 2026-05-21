# KhoTM Project Overview

KhoTM is a React Native / Expo application designed for warehouse management. It allows users to track inventory, scan QR codes for package identification, manage semi-finished products (BTP), raw materials (NL), and accessories/supplies (PL).

## Main Technologies

- **Framework:** Expo 54 (React Native 0.81.5)
- **Language:** JavaScript (React 19)
- **Navigation:** `@react-navigation/native`, `@react-navigation/stack`
- **UI Libraries:** `react-native-paper`, `lucide-react`, `react-native-vector-icons`, `react-native-toast-message`
- **Hardware Integration:** `expo-camera` (QR Scanning)
- **Data Management:**
  - `axios` for HTTP requests
  - `@react-native-async-storage/async-storage` for local persistence
- **Animation/Gestures:** `react-native-reanimated`, `react-native-gesture-handler`

## Project Structure

- `App.js`: Main entry point and navigation configuration.
- `screens/`: Contains all application screens.
  - `LoginScreen.js`: User authentication.
  - `HomeScreen.js`: Dashboard with warehouse overview.
  - `QRCodeScanner.js`: QR code scanning utility.
  - `KhoBTP/`: Screens specific to Semi-finished products (Merge/Split packages, Details).
  - `KhoNL/`: Screens specific to Raw materials.
  - `KhoPL/`: Screens specific to Accessories/Supplies.
- `assets/`: Images and static assets.
- `apiConfig.json`: Contains the primary API base URL.
- `request(main).http`: Sample API requests for development and testing.

## Building and Running

### Prerequisites

- Node.js
- Expo CLI (`npm install -g expo-cli`)
- Android Studio / Xcode (for local emulation) or Expo Go app (for physical device)

### Commands

- **Install Dependencies:** `npm install`
- **Start Project:** `npx expo start`
- **Run on Android:** `npx expo run:android`
- **Run on iOS:** `npx expo run:ios`
- **Web Version:** `npx expo start --web`

## Development Conventions

- **Component Style:** Use functional components with hooks (`useState`, `useEffect`, `useCallback`).
- **State Management:** Use local state for UI logic and `AsyncStorage` for persistent data like user information (`userInfor`) and selected context (`selectedWarehouse`).
- **API Calls:** Use `axios` for all network requests. Refer to `apiConfig.json` for the base URL.
- **Styling:** Use `StyleSheet.create` for component-specific styles.
- **Navigation:** Use `useNavigation` hook within components to navigate between screens.

## API Integration

The app interacts with multiple backends:
- Primary: `https://apilayoutkho.z76.vn`
- Node API (Package management): `https://nodeapi.z76.vn/khotm`
- TAG_QTKD API (Inventory/Locations): `https://apipccc.z76.vn/api/TAG_QTKD`

Refer to `request(main).http` for specific endpoint examples and payload structures.
