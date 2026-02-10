import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [react()],

	// Tauri support — these settings are used when running inside Tauri desktop
	clearScreen: false,
	envPrefix: ["VITE_", "TAURI_"],
	build: {
		target:
			process.env.TAURI_PLATFORM === "windows" ? "chrome105" : "safari13",
		minify: !process.env.TAURI_DEBUG ? "esbuild" : false,
		sourcemap: !!process.env.TAURI_DEBUG,
	},
});
