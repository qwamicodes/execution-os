import { Text as RNText, type StyleProp, type TextStyle } from "react-native";

interface TextProps {
	children: React.ReactNode;
	style?: StyleProp<TextStyle>;
	variant?: "heading" | "body" | "caption";
}

const variantStyles: Record<string, TextStyle> = {
	heading: { fontSize: 24, fontWeight: "700" },
	body: { fontSize: 16, fontWeight: "400" },
	caption: { fontSize: 12, fontWeight: "400", color: "#666" },
};

export function Text({ children, style, variant = "body" }: TextProps) {
	return <RNText style={[variantStyles[variant], style]}>{children}</RNText>;
}
