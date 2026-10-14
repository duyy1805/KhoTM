import React, { useState } from "react";
import { View } from "react-native";
import Svg, { Rect, Mask, Defs } from "react-native-svg";

const SCAN_SIZE = 250;
const BORDER_RADIUS = 20;

export default function ScanOverlay() {
    const [layout, setLayout] = useState({ width: 0, height: 0 });
    const scanSize = Math.min(SCAN_SIZE, layout.width, layout.height);
    const scanTop = (layout.height - scanSize) / 2;
    const scanLeft = (layout.width - scanSize) / 2;

    return (
        <View
            pointerEvents="none"
            style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }}
            onLayout={({ nativeEvent: { layout: nextLayout } }) => setLayout(nextLayout)}
        >
            {layout.width > 0 && layout.height > 0 && (
                <Svg width={layout.width} height={layout.height}>
                    <Defs>
                        <Mask id="mask">
                            <Rect x="0" y="0" width={layout.width} height={layout.height} fill="white" />
                            <Rect
                                x={scanLeft}
                                y={scanTop}
                                width={scanSize}
                                height={scanSize}
                                rx={BORDER_RADIUS}
                                ry={BORDER_RADIUS}
                                fill="black"
                            />
                        </Mask>
                    </Defs>

                    <Rect
                        x="0"
                        y="0"
                        width={layout.width}
                        height={layout.height}
                        fill="rgba(0,0,0,0.6)"
                        mask="url(#mask)"
                    />

                    <Rect
                        x={scanLeft}
                        y={scanTop}
                        width={scanSize}
                        height={scanSize}
                        rx={BORDER_RADIUS}
                        ry={BORDER_RADIUS}
                        stroke="white"
                        strokeWidth="2"
                        fill="transparent"
                    />
                </Svg>
            )}
        </View>
    );
}
