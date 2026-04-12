import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), "");
	const port = parseInt(env.PORT);
	const previewAllowedHosts = (
		env.VITE_PREVIEW_ALLOWED_HOSTS ||
		"localhost,127.0.0.1,eos-auth.topsociety.agency,eos.topsociety.agency"
	)
		.split(",")
		.map((host) => host.trim())
		.filter(Boolean);

	return {
		plugins: [
			tanstackRouter({
				target: "react",
				autoCodeSplitting: true,
			}),
			react(),
			tailwindcss(),
		],
		server: {
			port,
			host: "0.0.0.0",
			strictPort: true,
			allowedHosts: previewAllowedHosts,
		},
		preview: {
			port,
			host: "0.0.0.0",
			strictPort: true,
			allowedHosts: previewAllowedHosts,
		},
	};
});
