import { Button } from "@repo/ui/components/ui/button";
import { Spinner } from "@repo/ui/components/ui/spinner";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { z } from "zod";
import { AuthCard } from "../../components/auth-card";
import * as api from "../../lib/api";
import { redirectToDashboard } from "../../lib/auth-store";

const searchSchema = z.object({
	token: z.string().min(1).catch(""),
});

export const Route = createFileRoute("/magic-link/verify")({
	validateSearch: searchSchema,
	component: MagicLinkVerifyPage,
});

function MagicLinkVerifyPage() {
	const { token } = Route.useSearch();

	const verifyMutation = useMutation({
		mutationFn: () => api.verifyMagicLink(token),
		onSuccess: () => redirectToDashboard(),
	})

	useEffect(() => {
		if (token) {
			verifyMutation.mutate();
		}
	}, [token]);

	if (!token) {
		return (
			<AuthCard
				title="Invalid link"
				description="This magic link appears to be invalid or incomplete"
			>
				<Button asChild className="w-full">
					<Link to="/magic-link">Request a new link</Link>
				</Button>
			</AuthCard>
		)
	}

	if (verifyMutation.isPending) {
		return (
			<AuthCard
				title="Signing you in"
				description="Verifying your magic link..."
			>
				<div className="flex justify-center py-4">
					<Spinner size="lg" />
				</div>
			</AuthCard>
		)
	}

	if (verifyMutation.error) {
		return (
			<AuthCard
				title="Link expired or invalid"
				description={verifyMutation.error.message}
			>
				<div className="space-y-3">
					<Button asChild className="w-full">
						<Link to="/magic-link">Request a new link</Link>
					</Button>
					<Button variant="outline" asChild className="w-full">
						<Link to="/login">Back to sign in</Link>
					</Button>
				</div>
			</AuthCard>
		)
	}

	return (
		<AuthCard title="Success" description="Redirecting to dashboard...">
			<div className="flex justify-center py-4">
				<Spinner size="lg" />
			</div>
		</AuthCard>
	)
}
