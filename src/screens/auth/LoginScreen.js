import React, { useEffect, useRef, useState } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TextInput,
    TouchableOpacity,
    Dimensions,
    Alert,
    ActivityIndicator,
    StatusBar,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Keyboard,
    Modal,
    Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import axios from 'axios';
import { KHO_PL_BASE_URL } from '../../services/khoPhuLieuApi';
import {
    API_ENVIRONMENTS,
    initializeApiEnvironment,
    setApiEnvironment,
} from '../../services/coreApiClient';
import { keyboardAwareScrollProps, webInputFocusProps } from '../../components/KeyboardDoneAccessory';

const { width, height } = Dimensions.get('window');

// Design Tokens (Matching UI_Design_System.md)
const COLORS = {
    primary: '#4F46E5', // Indigo 600
    primaryDark: '#4338CA',
    success: '#10B981',
    danger: '#EF4444',
    background: '#F8FAFC',
    surface: '#FFFFFF',
    textPrimary: '#1E293B',
    textSecondary: '#64748B',
    border: '#E2E8F0',
    inputBg: '#F1F5F9',
};

const STORAGE_KEYS = {
    REMEMBER: 'loginRememberMe',
    USERNAME: 'loginSavedUsername',
    PASSWORD: 'loginSavedPassword',
    AUTH: 'authToken',
    USER: 'userInfor',
};

const LoginScreen = () => {
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [usernameError, setUsernameError] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [rememberMe, setRememberMe] = useState(true);
    const [loading, setLoading] = useState(false);
    const [environmentLoading, setEnvironmentLoading] = useState(true);
    const [apiEnvironment, setApiEnvironmentState] = useState(API_ENVIRONMENTS.PRODUCTION);
    const [settingsVisible, setSettingsVisible] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const passwordInputRef = useRef(null);

    useEffect(() => {
        (async () => {
            try {
                const [savedRemember, savedUser, savedPass, savedEnvironment] = await Promise.all([
                    AsyncStorage.getItem(STORAGE_KEYS.REMEMBER),
                    AsyncStorage.getItem(STORAGE_KEYS.USERNAME),
                    AsyncStorage.getItem(STORAGE_KEYS.PASSWORD),
                    initializeApiEnvironment(),
                ]);
                setApiEnvironmentState(savedEnvironment);
                const remember = savedRemember === 'true';
                setRememberMe(remember);
                if (remember) {
                    if (savedUser) setUsername(savedUser);
                    if (savedPass) setPassword(savedPass);
                }
            } catch (e) {
                // ignore
            } finally {
                setEnvironmentLoading(false);
            }
        })();
    }, []);

    const handleEnvironmentChange = async (environment) => {
        if (environmentLoading || loading) return;
        if (environment === apiEnvironment) {
            setSettingsVisible(false);
            return;
        }
        setEnvironmentLoading(true);
        try {
            const selectedEnvironment = await setApiEnvironment(environment);
            await AsyncStorage.multiRemove([STORAGE_KEYS.AUTH, STORAGE_KEYS.USER, 'selectedWarehouse']);
            setApiEnvironmentState(selectedEnvironment);
            setSettingsVisible(false);
        } catch {
            Toast.show({
                type: 'error',
                text1: 'Không thể đổi môi trường',
                text2: 'Vui lòng thử lại.',
            });
        } finally {
            setEnvironmentLoading(false);
        }
    };

    const validate = () => {
        let ok = true;
        if (!username.trim()) {
            setUsernameError('Tên đăng nhập không được để trống.');
            ok = false;
        } else if (username.trim().length < 4) {
            setUsernameError('Tên đăng nhập phải từ 4 ký tự trở lên.');
            ok = false;
        } else setUsernameError('');

        if (!password.trim()) {
            setPasswordError('Mật khẩu không được để trống.');
            ok = false;
        } else if (password.trim().length < 6) {
            setPasswordError('Mật khẩu phải từ 6 ký tự trở lên.');
            ok = false;
        } else setPasswordError('');

        return ok;
    };

    const saveRememberedIfNeeded = async () => {
        try {
            await AsyncStorage.setItem(STORAGE_KEYS.REMEMBER, rememberMe ? 'true' : 'false');
            if (rememberMe) {
                await AsyncStorage.setItem(STORAGE_KEYS.USERNAME, username);
                await AsyncStorage.setItem(STORAGE_KEYS.PASSWORD, password);
            } else {
                await AsyncStorage.multiRemove([STORAGE_KEYS.USERNAME, STORAGE_KEYS.PASSWORD]);
            }
        } catch { }
    };

    const handleLogin = async () => {
        if (environmentLoading || !validate()) return;
        setLoading(true);
        try {
            const response = await axios.post(`${KHO_PL_BASE_URL}/login`, {
                userName: username,
                passWord: password,
            });

            const accessToken = response?.data?.token || response?.data?.accessToken || response?.data?.access_token;
            const refreshToken = response?.data?.refreshToken || response?.data?.refresh_token;
            await AsyncStorage.setItem(STORAGE_KEYS.AUTH, JSON.stringify({
                ...response.data,
                token: accessToken,
                accessToken,
                refreshToken,
            }));

            try {
                const res = await axios.post(
                    `${KHO_PL_BASE_URL}/login/userInfo`,
                    JSON.stringify(refreshToken),
                    { headers: { 'Content-Type': 'application/json' } }
                );
                await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(res.data));
            } catch (e) {
                console.error('Lỗi lấy thông tin người dùng:', e?.response?.data || e.message);
            }

            await saveRememberedIfNeeded();

            if (response.data && accessToken) {
                Toast.show({
                    type: 'success',
                    text1: 'Đăng nhập thành công!',
                    text2: `Xin chào, ${username}`,
                });
                setTimeout(() => {
                    navigation.reset({ index: 0, routes: [{ name: 'HomeScreen' }] });
                }, 800);
            } else {
                Toast.show({
                    type: 'error',
                    text1: 'Đăng nhập thất bại',
                    text2: response.data?.message || 'Tài khoản hoặc mật khẩu không đúng.',
                });
            }
        } catch (error) {
            console.error(error);
            Toast.show({
                type: 'error',
                text1: 'Lỗi kết nối',
                text2: 'Không thể kết nối đến máy chủ. Vui lòng thử lại.',
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
            <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
            <TouchableOpacity
                style={[styles.settingsButton, { top: insets.top + 12 }]}
                onPress={() => setSettingsVisible(true)}
                disabled={loading}
                accessibilityRole="button"
                accessibilityLabel="Cài đặt môi trường"
            >
                <Ionicons name="settings-outline" size={23} color={COLORS.primary} />
            </TouchableOpacity>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    {...keyboardAwareScrollProps()}
                >
                    <View style={styles.headerSection}>
                        <View style={styles.logoCircle}>
                            <Ionicons name="cube" size={40} color={COLORS.primary} />
                        </View>
                        <Text style={styles.welcomeText}>KhoTM Management</Text>
                        <Text style={styles.subText}>Hệ thống quản lý kho thông minh</Text>
                    </View>

                    <View style={styles.formSection}>
                        <Text style={styles.loginTitle}>Đăng Nhập</Text>

                        <View style={styles.inputWrapper}>
                            <Text style={styles.inputLabel}>Tên đăng nhập</Text>
                            <View style={[styles.inputContainer, usernameError ? styles.inputError : null]}>
                                <Ionicons name="person-outline" size={20} color={COLORS.textSecondary} style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="Nhập tên đăng nhập"
                                    placeholderTextColor={COLORS.textSecondary}
                                    value={username}
                                    onChangeText={setUsername}
                                    autoCapitalize="none"
                                    returnKeyType="next"
                                    onSubmitEditing={() => passwordInputRef.current?.focus()}
                                    {...webInputFocusProps()}
                                />
                            </View>
                            {usernameError ? <Text style={styles.errorText}>{usernameError}</Text> : null}
                        </View>

                        <View style={styles.inputWrapper}>
                            <Text style={styles.inputLabel}>Mật khẩu</Text>
                            <View style={[styles.inputContainer, passwordError ? styles.inputError : null]}>
                                <Ionicons name="lock-closed-outline" size={20} color={COLORS.textSecondary} style={styles.inputIcon} />
                                <TextInput
                                    ref={passwordInputRef}
                                    style={styles.input}
                                    placeholder="Nhập mật khẩu"
                                    placeholderTextColor={COLORS.textSecondary}
                                    secureTextEntry={!showPassword}
                                    value={password}
                                    onChangeText={setPassword}
                                    returnKeyType="go"
                                    onSubmitEditing={() => { Keyboard.dismiss(); handleLogin(); }}
                                    {...webInputFocusProps()}
                                />
                                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                                    <Ionicons
                                        name={showPassword ? "eye-off-outline" : "eye-outline"}
                                        size={20}
                                        color={COLORS.textSecondary}
                                    />
                                </TouchableOpacity>
                            </View>
                            {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}
                        </View>

                        <View style={styles.actionRow}>
                            <TouchableOpacity
                                style={styles.rememberRow}
                                onPress={() => setRememberMe((v) => !v)}
                                activeOpacity={0.7}
                            >
                                <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                                    {rememberMe && <Ionicons name="checkmark" size={14} color="#fff" />}
                                </View>
                                <Text style={styles.rememberText}>Ghi nhớ đăng nhập</Text>
                            </TouchableOpacity>

                            <TouchableOpacity>
                                <Text style={styles.forgotText}>Quên mật khẩu?</Text>
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity
                            style={[styles.loginButton, (loading || environmentLoading) && { opacity: 0.8 }]}
                            onPress={handleLogin}
                            disabled={loading || environmentLoading}
                        >
                            {loading || environmentLoading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.loginButtonText}>Đăng Nhập</Text>
                            )}
                        </TouchableOpacity>

                        <View style={styles.footer}>
                            <Text style={styles.footerText}>Chưa có tài khoản? </Text>
                            <TouchableOpacity onPress={() =>
                                Alert.alert("Thông báo", "Vui lòng liên hệ quản trị viên để cấp tài khoản.")
                            }>
                                <Text style={styles.registerLink}>Liên hệ</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
            <Modal
                visible={settingsVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setSettingsVisible(false)}
            >
                <View style={styles.modalBackdrop}>
                    <Pressable style={StyleSheet.absoluteFill} onPress={() => setSettingsVisible(false)} />
                    <View style={styles.settingsModal}>
                        <View style={styles.settingsModalHeader}>
                            <View>
                                <Text style={styles.settingsModalTitle}>Cài đặt</Text>
                                <Text style={styles.settingsModalSubtitle}>Chọn môi trường sử dụng</Text>
                            </View>
                            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setSettingsVisible(false)}>
                                <Ionicons name="close" size={22} color={COLORS.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.environmentOptions}>
                            <TouchableOpacity
                                style={[
                                    styles.environmentOption,
                                    apiEnvironment === API_ENVIRONMENTS.PRODUCTION && styles.environmentOptionProduction,
                                ]}
                                onPress={() => handleEnvironmentChange(API_ENVIRONMENTS.PRODUCTION)}
                                disabled={environmentLoading || loading}
                            >
                                <Ionicons
                                    name="server-outline"
                                    size={18}
                                    color={apiEnvironment === API_ENVIRONMENTS.PRODUCTION ? '#FFFFFF' : COLORS.textSecondary}
                                />
                                <Text style={[
                                    styles.environmentOptionText,
                                    apiEnvironment === API_ENVIRONMENTS.PRODUCTION && styles.environmentOptionTextSelected,
                                ]}>Hệ thống thật</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[
                                    styles.environmentOption,
                                    apiEnvironment === API_ENVIRONMENTS.TEST && styles.environmentOptionTest,
                                ]}
                                onPress={() => handleEnvironmentChange(API_ENVIRONMENTS.TEST)}
                                disabled={environmentLoading || loading}
                            >
                                <Ionicons
                                    name="flask-outline"
                                    size={18}
                                    color={apiEnvironment === API_ENVIRONMENTS.TEST ? '#FFFFFF' : COLORS.textSecondary}
                                />
                                <Text style={[
                                    styles.environmentOptionText,
                                    apiEnvironment === API_ENVIRONMENTS.TEST && styles.environmentOptionTextSelected,
                                ]}>Hệ thống test</Text>
                            </TouchableOpacity>
                        </View>
                        {apiEnvironment === API_ENVIRONMENTS.TEST && (
                            <View style={styles.testWarning}>
                                <Ionicons name="warning-outline" size={16} color="#B45309" />
                                <Text style={styles.testWarningText}>Đang sử dụng dữ liệu thử nghiệm</Text>
                            </View>
                        )}
                    </View>
                </View>
            </Modal>
            <Toast />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    settingsButton: {
        position: 'absolute',
        right: 20,
        zIndex: 10,
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: COLORS.surface,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
        elevation: 3,
    },
    scrollContent: {
        flexGrow: 1,
        paddingHorizontal: 24,
        paddingBottom: 40,
    },
    headerSection: {
        alignItems: 'center',
        marginTop: height * 0.08,
        marginBottom: 40,
    },
    logoCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#EEF2FF',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
    },
    welcomeText: {
        fontSize: 24,
        fontWeight: '700',
        color: COLORS.textPrimary,
        marginBottom: 8,
    },
    subText: {
        fontSize: 14,
        color: COLORS.textSecondary,
    },
    formSection: {
        backgroundColor: COLORS.surface,
        borderRadius: 24,
        padding: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.05,
        shadowRadius: 20,
        elevation: 5,
    },
    loginTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: COLORS.textPrimary,
        marginBottom: 24,
    },
    environmentOptions: {
        flexDirection: 'row',
        gap: 10,
    },
    environmentOption: {
        flex: 1,
        minHeight: 46,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: COLORS.border,
        backgroundColor: COLORS.inputBg,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 7,
        paddingHorizontal: 10,
    },
    environmentOptionProduction: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary,
    },
    environmentOptionTest: {
        backgroundColor: '#D97706',
        borderColor: '#D97706',
    },
    environmentOptionText: {
        color: COLORS.textSecondary,
        fontSize: 13,
        fontWeight: '700',
    },
    environmentOptionTextSelected: {
        color: '#FFFFFF',
    },
    testWarning: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 10,
        paddingVertical: 8,
        paddingHorizontal: 10,
        borderRadius: 10,
        backgroundColor: '#FEF3C7',
    },
    testWarningText: {
        color: '#92400E',
        fontSize: 12,
        fontWeight: '600',
    },
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.45)',
        justifyContent: 'center',
        paddingHorizontal: 24,
    },
    settingsModal: {
        backgroundColor: COLORS.surface,
        borderRadius: 20,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.2,
        shadowRadius: 24,
        elevation: 10,
    },
    settingsModalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 20,
    },
    settingsModalTitle: {
        color: COLORS.textPrimary,
        fontSize: 20,
        fontWeight: '700',
    },
    settingsModalSubtitle: {
        color: COLORS.textSecondary,
        fontSize: 13,
        marginTop: 4,
    },
    modalCloseButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: COLORS.inputBg,
        justifyContent: 'center',
        alignItems: 'center',
    },
    inputWrapper: {
        marginBottom: 20,
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.textPrimary,
        marginBottom: 8,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.inputBg,
        borderRadius: 12,
        paddingHorizontal: 16,
        height: 56,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    inputIcon: {
        marginRight: 12,
    },
    input: {
        flex: 1,
        fontSize: 16,
        color: COLORS.textPrimary,
        height: '100%',
    },
    inputError: {
        borderColor: COLORS.danger,
        backgroundColor: '#FEF2F2',
    },
    errorText: {
        color: COLORS.danger,
        fontSize: 12,
        marginTop: 4,
        marginLeft: 4,
    },
    actionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    rememberRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    checkbox: {
        width: 20,
        height: 20,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: COLORS.border,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 8,
        backgroundColor: COLORS.surface,
    },
    checkboxChecked: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary,
    },
    rememberText: {
        fontSize: 14,
        color: COLORS.textSecondary,
    },
    forgotText: {
        fontSize: 14,
        color: COLORS.primary,
        fontWeight: '600',
    },
    loginButton: {
        backgroundColor: COLORS.primary,
        borderRadius: 12,
        height: 56,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    loginButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 24,
    },
    footerText: {
        fontSize: 14,
        color: COLORS.textSecondary,
    },
    registerLink: {
        fontSize: 14,
        color: COLORS.primary,
        fontWeight: '700',
    },
});

export default LoginScreen;
