import { useState, useEffect } from "react";
import { Text, View, Button, StyleSheet } from "react-native";
import Toast from "react-native-toast-message";
import { CameraView, useCameraPermissions } from "expo-camera";

export default function QRCodeScanner() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [qrData, setQrData] = useState("");

  useEffect(() => {
    if (!permission) {
      requestPermission();
    }
  }, [permission]);

  if (!permission) {
    return <View />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>
          We need camera permission to scan QR codes
        </Text>
        <Button onPress={requestPermission} title="Grant Permission" />
      </View>
    );
  }

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    if (!scanned) {
      setScanned(true); // Chặn quét tiếp theo

      try {
        setQrData(data); // Lưu mã pallet
        Toast.show({
          type: "success",
          text1: "QR Code Scanned",
          text2: `Mã QR: ${data}`,
          position: "top",
          visibilityTime: 1500,
        });
      } catch (error) {
        Toast.show({
          type: "error",
          text1: `Invalid QR Data ${data}`,
          text2: "Không phải định dạng JSON hợp lệ!",
          position: "top",
        });
      }

      setTimeout(() => {
        setScanned(false); // Cho phép quét lại sau 1 giây
      }, 1000);
    }
  };

  return (
    <View style={styles.container}>
      {/* Camera toàn màn hình */}
      <CameraView
        style={styles.camera}
        cameraType="back"
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ["qr"],
        }}
      >
        {/* Vùng quét nhỏ hơn */}
        <View style={styles.scanArea} />
      </CameraView>
      <Toast />
      {qrData ? <Text style={styles.text}>QR Data: {qrData}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    marginTop: 50,
    // justifyContent: "center",
    alignItems: "center",
  },
  camera: {
    // flex: 1,
    width: "100%",
    height: 400,
    justifyContent: "center",
    alignItems: "center",
  },
  scanArea: {
    width: 250, // Kích thước vùng quét
    height: 250,
    borderWidth: 2,
    borderColor: "red",
    backgroundColor: "rgba(81, 255, 0, 0.2)", // Làm nổi bật vùng quét
  },
  message: {
    textAlign: "center",
    paddingBottom: 10,
  },
  text: {
    position: "absolute",
    bottom: 50,
    fontSize: 18,
    backgroundColor: "white",
    padding: 10,
    borderRadius: 5,
  },
});
