import React, { useState, useEffect } from "react";
import { Text, View, StyleSheet, TouchableOpacity, StatusBar } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import ScanOverlay from "../../components/warehouse/ScanOverlay";

// Design Tokens
const COLORS = {
    primary: '#4F46E5',
    background: '#F8FAFC',
    surface: '#FFFFFF',
    textPrimary: '#1E293B',
    white: '#FFFFFF',
};

export default function QRCodeScanner({ navigation }) {
    const insets = useSafeAreaInsets();
    const [permission, requestPermission] = useCameraPermissions();
    const [scanned, setScanned] = useState(false);
    const [qrData, setQrData] = useState("");

    useEffect(() => {
        if (!permission) {
            requestPermission();
        }
    }, [permission]);

    const handleBarCodeScanned = ({ data }) => {
        if (!scanned) {
            setScanned(true);
            setQrData(data);
            Toast.show({
                type: "success",
                text1: "Đã quét mã QR",
                text2: data,
                position: "top",
                visibilityTime: 1500,
            });

            setTimeout(() => {
                setScanned(false);
            }, 2000);
        }
    };

    if (!permission) return <View style={styles.container} />;

    if (!permission.granted) {
        return (
            <View style={[styles.container, { paddingTop: insets.top + 40 }]}>
                <Ionicons name="camera-outline" size={64} color={COLORS.primary} />
                <Text style={styles.message}>
                    Ứng dụng cần quyền truy cập Camera để quét mã QR
                </Text>
                <TouchableOpacity style={styles.grantBtn} onPress={requestPermission}>
                    <Text style={styles.grantBtnText}>Cấp quyền truy cập</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
            
            <CameraView
                style={styles.camera}
                cameraType="back"
                onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            />
            <ScanOverlay />

            <TouchableOpacity 
                style={[styles.backBtn, { top: insets.top + 20 }]} 
                onPress={() => navigation.goBack()}
            >
                <Ionicons name="arrow-back" size={24} color={COLORS.white} />
            </TouchableOpacity>

            <View style={styles.overlayBottom}>
                <View style={styles.hintBox}>
                    <Text style={styles.hintText}>
                        Căn chỉnh mã QR vào khung để quét
                    </Text>
                </View>
                {qrData ? (
                    <View style={styles.dataCard}>
                        <Text style={styles.dataLabel}>Dữ liệu vừa quét:</Text>
                        <Text style={styles.dataValue} numberOfLines={2}>{qrData}</Text>
                    </View>
                ) : null}
            </View>

            <Toast />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    camera: {
        flex: 1,
    },
    message: {
        color: '#fff',
        textAlign: "center",
        paddingHorizontal: 40,
        marginTop: 20,
        marginBottom: 30,
        fontSize: 16,
    },
    grantBtn: {
        backgroundColor: COLORS.primary,
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 12,
    },
    grantBtnText: {
        color: '#fff',
        fontWeight: '700',
    },
    backBtn: {
        position: 'absolute',
        left: 20,
        zIndex: 10,
        backgroundColor: "rgba(0,0,0,0.5)",
        padding: 10,
        borderRadius: 25,
    },
    overlayBottom: {
        position: 'absolute',
        bottom: 50,
        left: 0,
        right: 0,
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    hintBox: {
        backgroundColor: 'rgba(0,0,0,0.7)',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 20,
        marginBottom: 20,
    },
    hintText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    dataCard: {
        backgroundColor: COLORS.surface,
        width: '100%',
        padding: 16,
        borderRadius: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 5,
    },
    dataLabel: {
        fontSize: 12,
        color: '#64748B',
        marginBottom: 4,
    },
    dataValue: {
        fontSize: 15,
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
});
