import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import QRCodeScanner from "./screens/QRCodeScanner";
import HomeScreen from "./screens/HomeScreen";
import WarehouseDetailScreen from "./screens/WarehouseDetailScreen";
import LoginScreen from "./screens/LoginScreen";
import { StyleSheet } from "react-native";
import ScannedDetail from "./screens/KhoBTP/ScannedDetail";
import ScannedDetailNL from "./screens/KhoNL/ScannedDetailNL";
import SelectLocationScreen from "./screens/SelectLocationScreen";
import PhieuXuatBTP from "./screens/KhoBTP/PhieuXuatBTP";
import PhieuXuatBTP_Detail from "./screens/KhoBTP/PhieuXuatBTP_Detail";
import MergePackageScreen from "./screens/KhoBTP/GhepKien";
import SplitPackageScreen from "./screens/KhoBTP/TachKien";
import LocationPickerModal from "./screens/KhoBTP/LocationPickerModal";
const Stack = createStackNavigator();

export default function App() {
  return (
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
        {/* //nguyên liệu */}
        <Stack.Screen
          name="ScannedDetailNL"
          component={ScannedDetailNL}
          options={{ headerShown: false, title: "Thông tin kiện NL" }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
});
