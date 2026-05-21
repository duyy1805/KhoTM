import React from "react";
import { Dimensions } from "react-native";
import Svg, { Rect, Mask, Defs } from "react-native-svg";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const SCAN_SIZE = 250;
const BORDER_RADIUS = 20;
const scanTop = (SCREEN_HEIGHT - SCAN_SIZE) / 2;
const scanLeft = (SCREEN_WIDTH - SCAN_SIZE) / 2;

export default function ScanOverlay() {
    return (
        <Svg
            width={SCREEN_WIDTH}
            height={SCREEN_HEIGHT}
            style={{ position: "absolute", top: 0, left: 0 }}
        >
            <Defs>
                <Mask id="mask">
                    {/* Vẽ nền trắng toàn màn hình (cho phép nhìn thấy vùng này) */}
                    <Rect
                        x="0"
                        y="0"
                        width={SCREEN_WIDTH}
                        height={SCREEN_HEIGHT}
                        fill="white"
                    />
                    {/* Vẽ lỗ bo cong (vùng quét) màu đen => bị đục lỗ */}
                    <Rect
                        x={scanLeft}
                        y={scanTop}
                        width={SCAN_SIZE}
                        height={SCAN_SIZE}
                        rx={BORDER_RADIUS}
                        ry={BORDER_RADIUS}
                        fill="black"
                    />
                </Mask>
            </Defs>

            {/* Lớp phủ tối dùng mask để đục lỗ */}
            <Rect
                x="0"
                y="0"
                width={SCREEN_WIDTH}
                height={SCREEN_HEIGHT}
                fill="rgba(0,0,0,0.6)"
                mask="url(#mask)"
            />

            {/* Viền vùng sáng */}
            <Rect
                x={scanLeft}
                y={scanTop}
                width={SCAN_SIZE}
                height={SCAN_SIZE}
                rx={BORDER_RADIUS}
                ry={BORDER_RADIUS}
                stroke="white"
                strokeWidth="2"
                fill="transparent"
            />
        </Svg>
    );
}
