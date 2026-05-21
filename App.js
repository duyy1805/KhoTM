import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { SafeAreaProvider } from "react-native-safe-area-context";
import QRCodeScanner from "./src/screens/shared/QRCodeScanner";
import HomeScreen from "./src/screens/home/HomeScreen";
import WarehouseDetailScreen from "./src/screens/home/WarehouseDetailScreen";
import LoginScreen from "./src/screens/auth/LoginScreen";
import { StyleSheet } from "react-native";
import ScannedDetail from "./src/screens/kho-btp/ScannedDetail";
import ScannedDetailNL from "./src/screens/kho-nl/ScannedDetailNL";
import ScannedDetailPL from "./src/screens/kho-pl/ScannedDetailPL";
import SelectLocationScreen from "./src/screens/shared/SelectLocationScreen";
import PhieuXuatBTP from "./src/screens/kho-btp/PhieuXuatBTP";
import PhieuXuatBTP_Detail from "./src/screens/kho-btp/PhieuXuatBTP_Detail";
import MergePackageScreen from "./src/screens/kho-btp/GhepKien";
import SplitPackageScreen from "./src/screens/kho-btp/TachKien";
import LocationPickerModal from "./src/screens/kho-btp/LocationPickerModal";

const Stack = createStackNavigator();

export default function App() {
  return (
    <SafeAreaProvider>
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
            options={{ headerShown: false, title: "Thông tin kiện" }}
          />
          <Stack.Screen
            name="SelectLocationScreen"
            component={SelectLocationScreen}
            options={{ headerShown: false, title: "Chọn vị trí" }}
          />
          <Stack.Screen
            name="PhieuXuatBTP"
            component={PhieuXuatBTP}
            options={{ headerShown: false, title: "Phiếu xuất BTP" }}
          />
          <Stack.Screen
            name="PhieuXuatBTP_Detail"
            component={PhieuXuatBTP_Detail}
            options={{ headerShown: false, title: "Chi tiết phiếu xuất BTP" }}
          />
          <Stack.Screen
            name="MergePackageScreen"
            component={MergePackageScreen}
            options={{ headerShown: false, title: "Ghép kiện" }}
          />
          <Stack.Screen
            name="SplitPackageScreen"
            component={SplitPackageScreen}
            options={{ headerShown: false, title: "Tách kiện" }}
          />
          <Stack.Screen
            name="LocationPickerModal"
            component={LocationPickerModal}
            options={{ headerShown: false }}
          />

          <Stack.Screen
            name="ScannedDetailNL"
            component={ScannedDetailNL}
            options={{ headerShown: false, title: "Thông tin kiện NL" }}
          />

          <Stack.Screen
            name="ScannedDetailPL"
            component={ScannedDetailPL}
            options={{ headerShown: false, title: "Thông tin kiện PL" }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
});
