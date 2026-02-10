import { Button, Text } from "@repo/ui-native";
import { StyleSheet, View } from "react-native";

export default function HomeScreen() {
	return (
		<View style={styles.container}>
			<Text variant="heading">Execution OS</Text>
			<Text variant="body">React Native + Expo</Text>
			<Button title="Get Started" />
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		gap: 16,
	},
});
