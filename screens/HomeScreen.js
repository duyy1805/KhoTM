import React, { useContext, useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, RefreshControl, TouchableOpacity, Dimensions, FlatList } from 'react-native';
import { Svg, Circle } from 'react-native-svg'; // Cần cài đặt react-native-svg
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from "@react-navigation/native";
import { Home } from 'lucide-react';
import AsyncStorage from '@react-native-async-storage/async-storage';
// Lấy chiều rộng màn hình để tính toán kích thước linh hoạt
const { width } = Dimensions.get('window');

// Component cho thanh tiến độ hình tròn
const CircularProgress = ({ percentage }) => {
    const radius = 30; // Bán kính của hình tròn
    const strokeWidth = 5; // Độ dày của đường viền
    const circumference = 2 * Math.PI * (radius - strokeWidth / 2);
    const progress = percentage / 100 * circumference;

    return (
        <View style={styles.progressContainer}>
            <Svg width={radius * 2} height={radius * 2}>
                {/* Đường viền nền */}
                <Circle
                    stroke="#e6e6e6"
                    fill="none"
                    cx={radius}
                    cy={radius}
                    r={radius - strokeWidth / 2}
                    strokeWidth={strokeWidth}
                />
                {/* Đường viền tiến độ */}
                <Circle
                    stroke="#4a90e2"
                    fill="none"
                    cx={radius}
                    cy={radius}
                    r={radius - strokeWidth / 2}
                    strokeWidth={strokeWidth}
                    strokeDasharray={`${circumference} ${circumference}`}
                    strokeDashoffset={circumference - progress}
                    strokeLinecap="round" // Bo tròn đầu đường viền
                    transform={`rotate(-90 ${radius} ${radius})`}
                />
            </Svg>
            <Text style={styles.progressText}>{percentage}%</Text>
        </View>
    );
};

// Component cho mỗi mục kho
const WarehouseItem = ({ title, pushedShelves, totalShelves, percentage }) => {
    return (
        <View style={styles.warehouseItem}>
            <View>
                <Text style={styles.warehouseTitle}>{title}</Text>
                <Text style={styles.warehouseSubtitle}>{pushedShelves}/{totalShelves} kệ đã đẩy</Text>
            </View>
            <CircularProgress percentage={percentage} />
        </View>
    );
};
const List = [
    { title: "Kho nguyên liệu", pushedShelves: 5, totalShelves: 20, id: 1 },
    { title: "Kho phụ liệu", pushedShelves: 10, totalShelves: 24, id: 3 },
    { title: "Kho thành phẩm", pushedShelves: 12, totalShelves: 24, id: 6 },
    { title: "Kho bán thành phẩm", pushedShelves: 6, totalShelves: 24, id: 5 },
].map(kho => ({
    ...kho,
    percentage: Number(((kho.pushedShelves / kho.totalShelves) * 100).toFixed(1))
}));
const HomeScreen = () => {
    const Navigation = useNavigation();
    const [userInfor, setUserInfor] = useState({});
    const [refreshing, setRefreshing] = useState(false);
    const [wareHouseList, setWareHouseList] = useState(List);
    const handleRefresh = useCallback(async () => {
        setRefreshing(true);

        try {
            setWareHouseList(wareHouseList);
        } catch (error) {
            console.error('Lỗi khi refresh:', error);
        } finally {
            setRefreshing(false);
        }
    }, []);
    useEffect(() => {
        const fetchUserInfo = async () => {
            try {
                const userInfo = await AsyncStorage.getItem('userInfor');
                if (userInfo) {
                    setUserInfor(JSON.parse(userInfo));
                } else {
                    console.warn('Không tìm thấy thông tin người dùng trong AsyncStorage');
                }
            } catch (error) {
                console.error('Lỗi khi lấy thông tin người dùng:', error);
            }
        };

        fetchUserInfo();
    }, []);
    const handleSelectWareHouse = (kho) => {
        AsyncStorage.setItem('selectedWarehouse', JSON.stringify(kho));
        Navigation.navigate("WarehouseDetailScreen", { kho });
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.greeting}>Xin chào {userInfor.fullName}</Text>
                    <Text style={styles.efficiency}>Chúc bạn 1 ngày làm việc hiệu quả</Text>
                </View>
                <TouchableOpacity style={styles.logoutButton} onPress={() => Navigation.goBack()}>
                    {/* Biểu tượng mũi tên thoát */}
                    <Ionicons name="log-out-outline" style={styles.logoutIcon} />
                </TouchableOpacity>
            </View>

            {/* Danh sách các kho */}
            <FlatList
                data={wareHouseList}
                keyExtractor={(item, index) => index.toString()}
                contentContainerStyle={styles.warehouseList}
                renderItem={({ item }) => (
                    <TouchableOpacity onPress={() => handleSelectWareHouse(item)}>
                        <WarehouseItem
                            title={item?.title}
                            pushedShelves={item?.pushedShelves}
                            totalShelves={item?.totalShelves}
                            percentage={item?.percentage}
                        />
                    </TouchableOpacity>
                )}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={handleRefresh}
                    />
                }
            />


            {/* Navigation Bar (Footer) */}
            <View style={styles.navigationBar}>
                <TouchableOpacity style={styles.navItem}>
                    {/* Biểu tượng kho #4a90e2*/}
                    <Ionicons name="cube-outline" size={24} color="#4a90e2" />
                    <Text style={styles.navText}>Kho</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f8f8',
    },
    header: {
        backgroundColor: '#4a90e2', //#4a90e2
        padding: 30,
        paddingTop: 40, // Đảm bảo không bị che bởi notch trên iPhone
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    greeting: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#fff',
    },
    efficiency: {
        fontSize: 14,
        color: '#fff',
        marginTop: 5,
    },
    logoutButton: {
        padding: 10,
    },
    logoutIcon: {
        fontSize: 24,
        color: '#fff',
        transform: [{ rotateY: '180deg' }], // Xoay mũi tên để trông giống thoát
    },
    warehouseList: {
        padding: 15,
    },
    warehouseItem: {
        backgroundColor: '#fff',
        borderRadius: 10,
        padding: 25,
        marginBottom: 10,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 3, // Android shadow
    },
    warehouseTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
    },
    warehouseSubtitle: {
        fontSize: 14,
        color: '#777',
        marginTop: 5,
    },
    progressContainer: {
        position: 'relative',
        justifyContent: 'center',
        alignItems: 'center',
    },
    progressText: {
        position: 'absolute',
        fontSize: 12,
        fontWeight: 'bold',
        color: '#555',
    },
    navigationBar: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff',
        paddingVertical: 10,
        borderTopWidth: 1,
        borderTopColor: '#eee',
        position: 'absolute',
        bottom: 0,
        width: '100%',
    },
    navItem: {
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    navIcon: {
        fontSize: 24,
        color: '#4a90e2',
    },
    navText: {
        fontSize: 12,
        color: '#4a90e2',
        marginTop: 5,
    },
});

export default HomeScreen;
