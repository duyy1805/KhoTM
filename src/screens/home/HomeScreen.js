import React, { useContext, useState, useCallback, useEffect } from 'react';
import { 
    View, 
    Text, 
    StyleSheet, 
    RefreshControl, 
    TouchableOpacity, 
    Dimensions, 
    FlatList, 
    StatusBar,
    Platform,
    Alert
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Svg, Circle } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from "@react-navigation/native";
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');

// Design Tokens
const COLORS = {
    primary: '#4F46E5',
    primaryLight: '#EEF2FF',
    secondary: '#10B981',
    background: '#F8FAFC',
    surface: '#FFFFFF',
    textPrimary: '#1E293B',
    textSecondary: '#64748B',
    white: '#FFFFFF',
    border: '#E2E8F0',
};

const CircularProgress = ({ percentage, color = COLORS.primary }) => {
    const radius = 28;
    const strokeWidth = 6;
    const circumference = 2 * Math.PI * (radius - strokeWidth / 2);
    const progress = percentage / 100 * circumference;

    return (
        <View style={styles.progressContainer}>
            <Svg width={radius * 2} height={radius * 2}>
                <Circle
                    stroke="#E2E8F0"
                    fill="none"
                    cx={radius}
                    cy={radius}
                    r={radius - strokeWidth / 2}
                    strokeWidth={strokeWidth}
                />
                <Circle
                    stroke={color}
                    fill="none"
                    cx={radius}
                    cy={radius}
                    r={radius - strokeWidth / 2}
                    strokeWidth={strokeWidth}
                    strokeDasharray={`${circumference} ${circumference}`}
                    strokeDashoffset={circumference - progress}
                    strokeLinecap="round"
                    transform={`rotate(-90 ${radius} ${radius})`}
                />
            </Svg>
            <Text style={[styles.progressText, { color }]}>{Math.round(percentage)}%</Text>
        </View>
    );
};

const WarehouseItem = ({ title, pushedShelves, totalShelves, percentage, icon }) => {
    return (
        <View style={styles.warehouseItem}>
            <View style={styles.warehouseInfo}>
                <View style={styles.iconContainer}>
                    <Ionicons name={icon || "cube-outline"} size={24} color={COLORS.primary} />
                </View>
                <View style={styles.textContainer}>
                    <Text style={styles.warehouseTitle}>{title}</Text>
                    <View style={styles.statsRow}>
                        <Ionicons name="layers-outline" size={14} color={COLORS.textSecondary} />
                        <Text style={styles.warehouseSubtitle}>
                            {pushedShelves} / {totalShelves} kệ đã đẩy
                        </Text>
                    </View>
                </View>
            </View>
            <CircularProgress percentage={percentage} />
        </View>
    );
};

const INITIAL_DATA = [
    { title: "Kho nguyên liệu", pushedShelves: 5, totalShelves: 20, id: 1, icon: "leaf-outline" },
    { title: "Kho phụ liệu", pushedShelves: 10, totalShelves: 24, id: 3, icon: "construct-outline" },
    { title: "Kho thành phẩm", pushedShelves: 12, totalShelves: 24, id: 6, icon: "checkmark-done-circle-outline" },
    { title: "Kho bán thành phẩm", pushedShelves: 6, totalShelves: 24, id: 5, icon: "hammer-outline" },
].map(kho => ({
    ...kho,
    percentage: Number(((kho.pushedShelves / kho.totalShelves) * 100).toFixed(1))
}));

const HomeScreen = () => {
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const [userInfor, setUserInfor] = useState({});
    const [refreshing, setRefreshing] = useState(false);
    const [wareHouseList, setWareHouseList] = useState(INITIAL_DATA);

    const handleRefresh = useCallback(async () => {
        setRefreshing(true);
        // Simulate API call
        setTimeout(() => setRefreshing(false), 1000);
    }, []);

    useEffect(() => {
        const fetchUserInfo = async () => {
            try {
                const userInfo = await AsyncStorage.getItem('userInfor');
                if (userInfo) {
                    setUserInfor(JSON.parse(userInfo));
                }
            } catch (error) {
                console.error('Lỗi khi lấy thông tin người dùng:', error);
            }
        };
        fetchUserInfo();
    }, []);

    const handleSelectWareHouse = (kho) => {
        AsyncStorage.setItem('selectedWarehouse', JSON.stringify(kho));
        navigation.navigate("WarehouseDetailScreen", { kho });
    };

    const handleLogout = () => {
        Alert.alert(
            "Đăng xuất",
            "Bạn có chắc chắn muốn đăng xuất?",
            [
                { text: "Hủy", style: "cancel" },
                { 
                    text: "Đăng xuất", 
                    style: "destructive",
                    onPress: () => navigation.navigate("LoginScreen") 
                }
            ]
        );
    };

    return (
        <View style={[styles.container, { paddingBottom: insets.bottom }]}>
            <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
            
            {/* Header Section */}
            <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === 'android' ? 20 : 0) }]}>
                <View style={styles.headerTop}>
                    <View>
                        <Text style={styles.greeting}>Xin chào,</Text>
                        <Text style={styles.userName}>{userInfor.fullName || 'Người dùng'}</Text>
                    </View>
                    <TouchableOpacity style={styles.avatarButton} onPress={handleLogout}>
                        <View style={styles.avatarPlaceholder}>
                            <Ionicons name="person" size={20} color={COLORS.primary} />
                        </View>
                    </TouchableOpacity>
                </View>

                <View style={styles.summaryCard}>
                    <View style={styles.summaryItem}>
                        <Text style={styles.summaryLabel}>Tổng số kho</Text>
                        <Text style={styles.summaryValue}>4</Text>
                    </View>
                    <View style={styles.summaryDivider} />
                    <View style={styles.summaryItem}>
                        <Text style={styles.summaryLabel}>Kiện đã xử lý</Text>
                        <Text style={styles.summaryValue}>33</Text>
                    </View>
                </View>
            </View>

            {/* List Section */}
            <View style={styles.content}>
                <FlatList
                    data={wareHouseList}
                    keyExtractor={(item) => item.id.toString()}
                    contentContainerStyle={styles.listContainer}
                    showsVerticalScrollIndicator={false}
                    renderItem={({ item }) => (
                        <TouchableOpacity 
                            activeOpacity={0.7}
                            onPress={() => handleSelectWareHouse(item)}
                        >
                            <WarehouseItem
                                title={item.title}
                                pushedShelves={item.pushedShelves}
                                totalShelves={item.totalShelves}
                                percentage={item.percentage}
                                icon={item.icon}
                            />
                        </TouchableOpacity>
                    )}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={handleRefresh}
                            colors={[COLORS.primary]}
                        />
                    }
                />
            </View>

            {/* Custom Bottom Navigation (Floating Style) */}
            <View style={[styles.bottomNavContainer, { bottom: insets.bottom + 20 }]}>
                <View style={styles.bottomNav}>
                    <TouchableOpacity style={styles.navItem}>
                        <Ionicons name="home" size={24} color={COLORS.primary} />
                        <Text style={[styles.navText, { color: COLORS.primary }]}>Trang chủ</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate("QRCodeScanner")}>
                        <View style={styles.scanButton}>
                            <Ionicons name="qr-code-outline" size={28} color={COLORS.white} />
                        </View>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.navItem}>
                        <Ionicons name="settings-outline" size={24} color={COLORS.textSecondary} />
                        <Text style={styles.navText}>Cài đặt</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    header: {
        backgroundColor: COLORS.primary,
        paddingHorizontal: 24,
        paddingBottom: 50,
        borderBottomLeftRadius: 32,
        borderBottomRightRadius: 32,
    },
    headerTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    greeting: {
        fontSize: 14,
        color: 'rgba(255, 255, 255, 0.8)',
    },
    userName: {
        fontSize: 20,
        fontWeight: '700',
        color: COLORS.white,
    },
    avatarButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarPlaceholder: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: COLORS.white,
        justifyContent: 'center',
        alignItems: 'center',
    },
    summaryCard: {
        flexDirection: 'row',
        backgroundColor: COLORS.white,
        borderRadius: 20,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 5,
    },
    summaryItem: {
        flex: 1,
        alignItems: 'center',
    },
    summaryDivider: {
        width: 1,
        height: '100%',
        backgroundColor: COLORS.border,
    },
    summaryLabel: {
        fontSize: 12,
        color: COLORS.textSecondary,
        marginBottom: 4,
    },
    summaryValue: {
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    content: {
        flex: 1,
        marginTop: -30,
        paddingHorizontal: 24,
    },
    listContainer: {
        paddingTop: 10,
        paddingBottom: 120,
    },
    warehouseItem: {
        backgroundColor: COLORS.surface,
        borderRadius: 20,
        padding: 16,
        marginBottom: 16,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    warehouseInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 12,
        backgroundColor: COLORS.primaryLight,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    textContainer: {
        flex: 1,
    },
    warehouseTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.textPrimary,
        marginBottom: 4,
    },
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    warehouseSubtitle: {
        fontSize: 13,
        color: COLORS.textSecondary,
    },
    progressContainer: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    progressText: {
        position: 'absolute',
        fontSize: 11,
        fontWeight: '700',
    },
    bottomNavContainer: {
        position: 'absolute',
        left: 0,
        right: 0,
        alignItems: 'center',
        paddingHorizontal: 24,
    },
    bottomNav: {
        flexDirection: 'row',
        backgroundColor: COLORS.surface,
        borderRadius: 30,
        height: 70,
        width: '100%',
        alignItems: 'center',
        justifyContent: 'space-around',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 10,
        paddingHorizontal: 10,
    },
    navItem: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    navText: {
        fontSize: 11,
        fontWeight: '600',
        color: COLORS.textSecondary,
        marginTop: 4,
    },
    scanButton: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: COLORS.primary,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: -40,
        borderWidth: 5,
        borderColor: COLORS.background,
    },
});

export default HomeScreen;
