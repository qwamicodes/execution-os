import { useEffect, useState } from "react";
import {
	applyThemePreference,
	getStoredThemePreference,
	setStoredThemePreference,
	type ThemePreference,
} from "@/lib/theme";

export function useThemePreference() {
	const [preference, setPreferenceState] = useState<ThemePreference>(() =>
		getStoredThemePreference(),
	);

	useEffect(() => {
		applyThemePreference(preference);
		setStoredThemePreference(preference);
	}, [preference]);

	useEffect(() => {
		if (typeof window === "undefined") return;
		const media = window.matchMedia("(prefers-color-scheme: dark)");
		const handleChange = () => {
			if (preference === "system") {
				applyThemePreference("system");
			}
		};
		media.addEventListener("change", handleChange);
		return () => media.removeEventListener("change", handleChange);
	}, [preference]);

	return {
		preference,
		setPreference: setPreferenceState,
	};
}
