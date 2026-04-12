import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), "");
	const port = parseInt(env.PORT);

	return {
		plugins: [
			tanstackRouter({ target: "react", autoCodeSplitting: true }),
			react(),
			tailwindcss(),
		],
		server: {
			port,
			host: "0.0.0.0",
			strictPort: true,
			allowedHosts: true,
		},
		preview: {
			port,
			host: "0.0.0.0",
			strictPort: true,
			allowedHosts: true,
		},
		resolve: { alias: { "@": "/src" } },

		// Tauri support — these settings are used when running inside Tauri desktop
		clearScreen: false,
		envPrefix: ["VITE_", "TAURI_"],
		build: {
			target:
				process.env.TAURI_PLATFORM === "windows" ? "chrome105" : "safari13",
			minify: !process.env.TAURI_DEBUG ? "esbuild" : false,
			sourcemap: !!process.env.TAURI_DEBUG,
		},
	};
});
