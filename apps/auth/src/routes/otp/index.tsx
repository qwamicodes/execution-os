import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@repo/ui/components/ui/button";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@repo/ui/components/ui/form";
import { Input } from "@repo/ui/components/ui/input";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { AuthCard } from "../../components/auth-card";
import * as api from "../../lib/api";

const otpRequestSchema = z.object({
	email: z.string().email("Invalid email address"),
});

type OtpRequestValues = z.infer<typeof otpRequestSchema>;

export const Route = createFileRoute("/otp/")({
	component: OtpRequestPage,
});

function OtpRequestPage() {
	const navigate = useNavigate();

	const form = useForm<OtpRequestValues>({
		resolver: zodResolver(otpRequestSchema),
		defaultValues: { email: "" },
	})

	const otpMutation = useMutation({
		mutationFn: (data: OtpRequestValues) => api.requestOtp(data.email),
		onSuccess: (_data, variables) => {
			navigate({
				to: "/otp/verify",
				search: { email: variables.email },
			})
		},
	})

	function onSubmit(data: OtpRequestValues) {
		otpMutation.mutate(data);
	}

	return (
		<AuthCard
			title="Sign in with OTP"
			description="We'll send a 6-digit code to your email"
			footer={
				<>
					Back to{" "}
					<Link to="/login" className="font-medium text-primary underline">
						Sign in
					</Link>
				</>
			}
		>
			<Form {...form}>
				<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
					<FormField
						control={form.control}
						name="email"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Email</FormLabel>
								<FormControl>
									<Input
										type="email"
										placeholder="you@example.com"
										{...field}
									/>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>

					{otpMutation.error && (
						<p className="text-sm text-destructive">
							{otpMutation.error.message}
						</p>
					)}

					<Button
						type="submit"
						className="w-full"
						disabled={otpMutation.isPending}
					>
						{otpMutation.isPending ? "Sending code..." : "Send code"}
					</Button>
				</form>
			</Form>
		</AuthCard>
	)
}
