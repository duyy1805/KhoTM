import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import QRCodeScanner from "./screens/QRCodeScanner";
import HomeScreen from "./screens/HomeScreen";
import WarehouseDetailScreen from "./screens/WarehouseDetailScreen";
import LoginScreen from "./screens/LoginScreen";
// import { AppProvider } from './AppContext';
import { StyleSheet } from "react-native";
import ScannedDetail from "./screens/ScannedDetail";
import SelectLocationScreen from "./screens/SelectLocationScreen";

const Stack = createStackNavigator();

export default function App() {
  return (
    // <AppProvider>
    <NavigationContainer>
      <Stack.Navigator initialRouteName="LoginScreen">
        <Stack.Screen
          name="LoginScreen"
          component={LoginScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="HomeScreen"
          component={HomeScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="WarehouseDetailScreen"
          component={WarehouseDetailScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="ScanQR"
          component={QRCodeScanner}
          options={{ title: "Quét Mã QR" }}
        />
        <Stack.Screen
          name="ScannedDetail"
          component={ScannedDetail}
          options={{ title: "Thông tin kiện" }}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="SelectLocationScreen"
          component={SelectLocationScreen}
          options={{ title: "Chọn vị trí" }}
          options={{ headerShown: false }}
        />
      </Stack.Navigator>
    </NavigationContainer>
    // </AppProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
});
