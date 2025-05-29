import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";

const WareHouseZone = () => {
  const navigation = useNavigation();
  const khuVucList = ["Khu A", "Khu B", "Khu C", "Nhà Thầu"];

  const handleSelectKhuVuc = (khuVuc: string) => {
    navigation.navigate("WarehouseDetail", { khuVuc });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Chọn Khu Vực</Text>
      {khuVucList.map((khuVuc) => (
        <TouchableOpacity
          key={khuVuc}
          style={styles.button}
          onPress={() => handleSelectKhuVuc(khuVuc)}
        >
          <Text style={styles.text}>{khuVuc}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

export default WareHouseZone;

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 20 },
  button: { padding: 15, backgroundColor: "blue", margin: 5, borderRadius: 5 },
  text: { color: "white", fontSize: 18 },
});
