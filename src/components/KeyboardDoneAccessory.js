import React from 'react';
import {
    InputAccessoryView,
    Keyboard,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

export const NUMERIC_KEYBOARD_ACCESSORY_ID = 'numeric-keyboard-done';

function scrollFocusedInputIntoView(event) {
    if (Platform.OS !== 'web') return;
    const target = event?.currentTarget;
    setTimeout(() => {
        const viewport = globalThis.visualViewport;
        const windowHeight = Number(globalThis.innerHeight || 0);
        const keyboardLikelyVisible = viewport && windowHeight > 0 && viewport.height < windowHeight * 0.85;
        if (keyboardLikelyVisible && typeof target?.scrollIntoView === 'function') {
            target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
        }
    }, 250);
}

export function webInputFocusProps() {
    return Platform.OS === 'web' ? { onFocus: scrollFocusedInputIntoView } : {};
}

export function numericKeyboardProps({ decimal = false } = {}) {
    return {
        keyboardType: decimal ? 'decimal-pad' : 'number-pad',
        inputMode: decimal ? 'decimal' : 'numeric',
        returnKeyType: 'done',
        ...webInputFocusProps(),
        ...(Platform.OS === 'ios'
            ? { inputAccessoryViewID: NUMERIC_KEYBOARD_ACCESSORY_ID }
            : { onSubmitEditing: Keyboard.dismiss }),
    };
}

export function keyboardAwareScrollProps() {
    return {
        keyboardShouldPersistTaps: 'handled',
        keyboardDismissMode: Platform.OS === 'ios' ? 'interactive' : 'on-drag',
        ...(Platform.OS === 'ios' ? { automaticallyAdjustKeyboardInsets: true } : {}),
    };
}

export default function KeyboardDoneAccessory() {
    if (Platform.OS !== 'ios') return null;

    return (
        <InputAccessoryView nativeID={NUMERIC_KEYBOARD_ACCESSORY_ID}>
            <View style={styles.bar}>
                <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Đóng bàn phím"
                    onPress={Keyboard.dismiss}
                    style={styles.button}
                >
                    <Text style={styles.buttonText}>Xong</Text>
                </TouchableOpacity>
            </View>
        </InputAccessoryView>
    );
}

const styles = StyleSheet.create({
    bar: {
        minHeight: 44,
        alignItems: 'flex-end',
        justifyContent: 'center',
        paddingHorizontal: 12,
        backgroundColor: '#F8FAFC',
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: '#CBD5E1',
    },
    button: { minWidth: 64, minHeight: 36, alignItems: 'center', justifyContent: 'center' },
    buttonText: { color: '#4F46E5', fontSize: 16, fontWeight: '800' },
});
