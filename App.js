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
import KhoPLInspectionListScreen from "./src/screens/kho-pl/KhoPLInspectionListScreen";
import KhoPLInspectionDetailScreen from "./src/screens/kho-pl/KhoPLInspectionDetailScreen";
import KhoPLExportListScreen from "./src/screens/kho-pl/KhoPLExportListScreen";
import KhoPLExportDetailScreen from "./src/screens/kho-pl/KhoPLExportDetailScreen";
import KhoPLExportQrFirstScreen from "./src/screens/kho-pl/KhoPLExportQrFirstScreen";
import KhoPLExportQrFirstCandidatesScreen from "./src/screens/kho-pl/KhoPLExportQrFirstCandidatesScreen";
import KhoPLTransferLocationScreen from "./src/screens/kho-pl/KhoPLTransferLocationScreen";
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
          <Stack.Screen
            name="KhoPLInspectionList"
            component={KhoPLInspectionListScreen}
            options={{ headerShown: false, title: "Biên bản giám định PL" }}
          />
          <Stack.Screen
            name="KhoPLInspectionDetail"
            component={KhoPLInspectionDetailScreen}
            options={{ headerShown: false, title: "Chi tiết giám định PL" }}
          />
          <Stack.Screen
            name="KhoPLExportList"
            component={KhoPLExportListScreen}
            options={{ headerShown: false, title: "Phiếu xuất PL" }}
          />
          <Stack.Screen
            name="KhoPLExportDetail"
            component={KhoPLExportDetailScreen}
            options={{ headerShown: false, title: "Chi tiết phiếu xuất PL" }}
          />
          <Stack.Screen
            name="KhoPLExportQrFirst"
            component={KhoPLExportQrFirstScreen}
            options={{ headerShown: false, title: "Quét QR trước" }}
          />
          <Stack.Screen
            name="KhoPLExportQrFirstCandidates"
            component={KhoPLExportQrFirstCandidatesScreen}
            options={{ headerShown: false, title: "Chọn phiếu xuất" }}
          />
          <Stack.Screen
            name="KhoPLTransferLocation"
            component={KhoPLTransferLocationScreen}
            options={{ headerShown: false, title: "Điều chuyển vị trí PL" }}
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
