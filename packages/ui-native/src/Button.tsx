import { Pressable, type StyleProp, Text, type ViewStyle } from "react-native";

interface ButtonProps {
	title: string;
	onPress?: () => void;
	style?: StyleProp<ViewStyle>;
}

export function Button({ title, onPress, style }: ButtonProps) {
	return (
		<Pressable
			onPress={onPress}
			style={[
				{
					backgroundColor: "#000",
					paddingHorizontal: 16,
					paddingVertical: 10,
					borderRadius: 8,
					alignItems: "center",
				},
				style,
			]}
		>
			<Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>
				{title}
			</Text>
		</Pressable>
	);
}
