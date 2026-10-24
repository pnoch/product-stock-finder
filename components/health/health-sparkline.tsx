import { View } from "react-native";
import Svg, { Polyline } from "react-native-svg";

export function HealthSparkline({
  data,
  color,
}: {
  data: number[];
  color: string;
}) {
  if (data.length < 2) return null;
  const width = 60;
  const height = 24;
  const pad = 2;
  const usableW = width - pad * 2;
  const usableH = height - pad * 2;
  const coords = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * usableW;
    const y = pad + (1 - v) * usableH;
    return `${x},${y}`;
  });
  return (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Polyline
          points={coords.join(" ")}
          fill="none"
          stroke={color}
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
}
