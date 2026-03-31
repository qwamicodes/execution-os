import { Button } from "@repo/ui/components/ui/button";
import {
	InputOTP,
	InputOTPGroup,
	InputOTPSlot,
} from "@repo/ui/components/ui/input-otp";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { AuthCard } from "../../components/auth-card";
import * as api from "../../lib/api";
import { redirectToDashboard } from "../../lib/auth-store";

const searchSchema = z.object({
	email: z.string().email().catch(""),
});

export const Route = createFileRoute("/otp/verify")({
	validateSearch: searchSchema,
	component: OtpVerifyPage,
});

function OtpVerifyPage() {
	const { email } = Route.useSearch();
	const [code, setCode] = useState("");
	const [resendTimer, setResendTimer] = useState(60);

	const verifyMutation = useMutation({
		mutationFn: () => api.verifyOtp(email, code),
		onSuccess: () => redirectToDashboard(),
	})

	const resendMutation = useMutation({
		mutationFn: () => api.requestOtp(email),
		onSuccess: () => setResendTimer(60),
	})

	function handleCodeChange(value: string) {
		setCode(value);
		if (value.length === 6 && email) {
			// Use setTimeout to allow state to update
			setTimeout(() => {
				verifyMutation.mutate();
			}, 0)
		}
	}

	// Resend countdown timer
	useEffect(() => {
		if (resendTimer <= 0) return;
		const interval = setInterval(() => {
			setResendTimer((prev) => prev - 1);
		}, 1000);
		return () => clearInterval(interval);
	}, [resendTimer]);

	if (!email) {
		return (
			<AuthCard
				title="Missing email"
				description="Please go back and enter your email first"
			>
				<Button asChild className="w-full">
					<Link to="/otp">Go back</Link>
				</Button>
			</AuthCard>
		)
	}

	return (
		<AuthCard
			title="Enter verification code"
			description={`We sent a 6-digit code to ${email}`}
			footer={
				<>
					Back to{" "}
					<Link to="/login" className="font-medium text-primary underline">
						Sign in
					</Link>
				</>
			}
		>
			<div className="flex flex-col items-center gap-4">
				<InputOTP
					maxLength={6}
					value={code}
					onChange={handleCodeChange}
					disabled={verifyMutation.isPending}
				>
					<InputOTPGroup>
						<InputOTPSlot index={0} />
						<InputOTPSlot index={1} />
						<InputOTPSlot index={2} />
						<InputOTPSlot index={3} />
						<InputOTPSlot index={4} />
						<InputOTPSlot index={5} />
					</InputOTPGroup>
				</InputOTP>

				{verifyMutation.error && (
					<p className="text-sm text-destructive">
						{verifyMutation.error.message}
					</p>
				)}

				<Button
					className="w-full"
					onClick={() => verifyMutation.mutate()}
					disabled={code.length !== 6 || verifyMutation.isPending}
				>
					{verifyMutation.isPending ? "Verifying..." : "Verify code"}
				</Button>

				<Button
					variant="ghost"
					size="sm"
					onClick={() => resendMutation.mutate()}
					disabled={resendTimer > 0 || resendMutation.isPending}
				>
					{resendTimer > 0
						? `Resend code in ${resendTimer}s`
						: resendMutation.isPending
							? "Sending..."
							: "Resend code"}
				</Button>
			</div>
		</AuthCard>
	)
}
