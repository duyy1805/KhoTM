import React, { useState } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TextInput,
    TouchableOpacity,
    Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiConfig from '../apiConfig.json';
import { useNavigation } from '@react-navigation/native';
import axios from 'axios';

const { width, height } = Dimensions.get('window');

const App = () => {
    const navigation = useNavigation();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [usernameError, setUsernameError] = useState('');
    const [passwordError, setPasswordError] = useState('');

    const handleLogin = async () => {
        let isValid = true;

        if (!username.trim()) {
            setUsernameError('Tên đăng nhập không được để trống.');
            isValid = false;
        } else if (username.trim().length < 4) {
            setUsernameError('Tên đăng nhập phải từ 4 ký tự trở lên.');
            isValid = false;
        } else {
            setUsernameError('');
        }

        if (!password.trim()) {
            setPasswordError('Mật khẩu không được để trống.');
            isValid = false;
        } else if (password.trim().length < 6) {
            setPasswordError('Mật khẩu phải từ 6 ký tự trở lên.');
            isValid = false;
        } else {
            setPasswordError('');
        }

        if (!isValid) {
            Toast.show({
                type: 'error',
                text1: 'Đăng nhập thất bại',
                text2: 'Vui lòng kiểm tra lại thông tin.',
            });
            return;
        }

        try {
            const response = await axios.post(`${apiConfig.API_BASE_URL}/login`, {
                userName: username,
                passWord: password,
            });

            const refreshToken = response.data.refreshToken;

            // Lưu token vào AsyncStorage
            await AsyncStorage.setItem('authToken', JSON.stringify(response.data));

            try {
                const res = await axios.post(
                    `${apiConfig.API_BASE_URL}/login/userInfo`,
                    refreshToken,
                    {
                        headers: {
                            'Content-Type': 'application/json',
                        },
                    }
                );

                const userInfor = res.data;
                console.log('Thông tin người dùng:', userInfor);
                await AsyncStorage.setItem('userInfor', JSON.stringify(userInfor));
            } catch (error) {
                console.error('Lỗi khi lấy thông tin người dùng:', error);
            }

            if (response.data && response.data.token) {
                Toast.show({
                    type: 'success',
                    text1: 'Đăng nhập thành công!',
                    text2: `Xin chào, ${username}`,
                });

                setTimeout(() => {
                    navigation.navigate('HomeScreen');
                }, 1000);
            } else {
                Toast.show({
                    type: 'error',
                    text1: 'Đăng nhập thất bại',
                    text2: response.data.message || 'Tài khoản hoặc mật khẩu không đúng.',
                });
            }
        } catch (error) {
            console.error(error);
            Toast.show({
                type: 'error',
                text1: 'Lỗi kết nối',
                text2: 'Không thể kết nối đến máy chủ. Vui lòng thử lại.',
            });
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.loginSection}>
                <Text style={styles.loginTitle}>Login</Text>

                <View style={styles.inputContainer}>
                    <TextInput
                        style={[styles.input, usernameError ? styles.inputError : null]}
                        placeholder="Username"
                        value={username}
                        onChangeText={setUsername}
                        autoCapitalize="none"
                    />
                    <Ionicons name="person" size={20} color="#666" style={styles.inputIcon} />
                    {usernameError ? <Text style={styles.errorText}>{usernameError}</Text> : null}
                </View>

                <View style={styles.inputContainer}>
                    <TextInput
                        style={[styles.input, passwordError ? styles.inputError : null]}
                        placeholder="Password"
                        secureTextEntry
                        value={password}
                        onChangeText={setPassword}
                    />
                    <Ionicons name="lock-closed" size={20} color="#666" style={styles.inputIcon} />
                    {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}
                </View>

                <TouchableOpacity style={styles.forgotPasswordButton}>
                    <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.loginButton} onPress={handleLogin}>
                    <Text style={styles.loginButtonText}>Login</Text>
                </TouchableOpacity>
            </View>
            <View style={styles.topSection}>
                <Text style={styles.welcomeText}>Hello, Welcome!</Text>
                <Text style={styles.registerPrompt}>Don't have an account?</Text>
                <TouchableOpacity style={styles.registerButton}>
                    <Text style={styles.registerButtonText}>Register</Text>
                </TouchableOpacity>
            </View>
            <Toast />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#E0E0E0',
    },
    topSection: {
        flex: 1,
        width: width - 20,
        position: 'absolute',
        marginTop: 10,
        marginHorizontal: 10,
        backgroundColor: '#8C9EFF',
        borderTopLeftRadius: width * 0.05,
        borderTopRightRadius: width * 0.05,
        borderBottomLeftRadius: width * 0.2,
        borderBottomRightRadius: width * 0.2,
        height: height * 0.25,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
        // zIndex: 1,
    },
    welcomeText: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 10,
    },
    registerPrompt: {
        fontSize: 16,
        color: '#fff',
        marginBottom: 15,
    },
    registerButton: {
        backgroundColor: 'transparent',
        borderColor: '#fff',
        borderWidth: 1,
        borderRadius: 25,
        paddingVertical: 10,
        paddingHorizontal: 30,
    },
    registerButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    loginSection: {
        flex: 1,
        backgroundColor: '#fff',
        marginHorizontal: 10,
        marginTop: height * 0.15,
        borderRadius: 20,
        padding: 25,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 8,
        marginBottom: 20,
        paddingTop: height * 0.15,
    },
    loginTitle: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 30,
        textAlign: 'center',
    },
    inputContainer: {
        marginBottom: 20,
        position: 'relative',
    },
    input: {
        height: 50,
        borderColor: '#ddd',
        borderWidth: 1,
        borderRadius: 10,
        paddingLeft: 45,
        paddingRight: 15,
        fontSize: 16,
        backgroundColor: '#f9f9f9',
    },
    inputError: {
        borderColor: 'red',
    },
    inputIcon: {
        position: 'absolute',
        left: 15,
        top: 15,
    },
    errorText: {
        color: 'red',
        fontSize: 12,
        marginTop: 5,
        marginLeft: 5,
    },
    forgotPasswordButton: {
        alignSelf: 'flex-end',
        marginBottom: 25,
    },
    forgotPasswordText: {
        color: '#8C9EFF',
        fontSize: 14,
    },
    loginButton: {
        backgroundColor: '#8C9EFF',
        borderRadius: 10,
        paddingVertical: 15,
        alignItems: 'center',
        marginBottom: 30,
        shadowColor: '#8C9EFF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 5,
    },
    loginButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    socialLoginText: {
        textAlign: 'center',
        color: '#666',
        marginBottom: 20,
        fontSize: 14,
    },
    socialButtonsContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 20, // Khoảng cách giữa các nút
    },
    socialButton: {
        backgroundColor: '#f0f0f0',
        borderRadius: 10,
        width: 50,
        height: 50,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 3,
    },
});

export default App;
