export type ThemePreference = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "execution-os-theme-preference";

function isThemePreference(value: string): value is ThemePreference {
	return value === "light" || value === "dark" || value === "system";
}

export function getStoredThemePreference(): ThemePreference {
	if (typeof window === "undefined") return "system";
	const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
	if (!stored || !isThemePreference(stored)) return "system";
	return stored;
}

export function resolveTheme(preference: ThemePreference): "light" | "dark" {
	if (
		preference === "system" &&
		typeof window !== "undefined" &&
		window.matchMedia("(prefers-color-scheme: dark)").matches
	) {
		return "dark";
	}
	return preference === "dark" ? "dark" : "light";
}

export function applyThemePreference(preference: ThemePreference) {
	if (typeof document === "undefined") return;
	const resolved = resolveTheme(preference);
	const root = document.documentElement;
	root.classList.toggle("dark", resolved === "dark");
	root.style.colorScheme = resolved;
}

export function setStoredThemePreference(preference: ThemePreference) {
	if (typeof window === "undefined") return;
	window.localStorage.setItem(THEME_STORAGE_KEY, preference);
}

export function initializeThemePreference() {
	const preference = getStoredThemePreference();
	applyThemePreference(preference);
	return preference;
}
