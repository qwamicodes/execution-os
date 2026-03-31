const DASHBOARD_URL =
	import.meta.env.VITE_DASHBOARD_URL || "http://localhost:8903";

export function redirectToDashboard() {
	window.location.href = DASHBOARD_URL;
}
