import { createFileRoute } from "@tanstack/react-router";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";

export const Route = createFileRoute("/onboarding")({
	component: OnboardingPage,
});

function OnboardingPage() {
	const { user } = Route.useRouteContext();

	return <OnboardingWizard user={user} />;
}
