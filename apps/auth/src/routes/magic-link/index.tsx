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
import { createFileRoute, Link } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { AuthCard } from "../../components/auth-card";
import * as api from "../../lib/api";

const magicLinkSchema = z.object({
	email: z.string().email("Invalid email address"),
});

type MagicLinkValues = z.infer<typeof magicLinkSchema>;

export const Route = createFileRoute("/magic-link/")({
	component: MagicLinkRequestPage,
});

function MagicLinkRequestPage() {
	const form = useForm<MagicLinkValues>({
		resolver: zodResolver(magicLinkSchema),
		defaultValues: { email: "" },
	})

	const magicLinkMutation = useMutation({
		mutationFn: (data: MagicLinkValues) => api.requestMagicLink(data.email),
	})

	function onSubmit(data: MagicLinkValues) {
		magicLinkMutation.mutate(data);
	}

	if (magicLinkMutation.isSuccess) {
		return (
			<AuthCard
				title="Check your email"
				description="We sent a sign-in link to your email address"
				footer={
					<>
						Back to{" "}
						<Link to="/login" className="font-medium text-primary underline">
							Sign in
						</Link>
					</>
				}
			>
				<div className="text-center">
					<p className="mb-4 text-sm text-muted-foreground">
						Click the link in your email to sign in. The link expires in 15
						minutes.
					</p>
					<Button
						variant="outline"
						onClick={() => magicLinkMutation.reset()}
						className="w-full"
					>
						Send another link
					</Button>
				</div>
			</AuthCard>
		)
	}

	return (
		<AuthCard
			title="Sign in with magic link"
			description="We'll email you a link to sign in instantly"
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

					{magicLinkMutation.error && (
						<p className="text-sm text-destructive">
							{magicLinkMutation.error.message}
						</p>
					)}

					<Button
						type="submit"
						className="w-full"
						disabled={magicLinkMutation.isPending}
					>
						{magicLinkMutation.isPending
							? "Sending link..."
							: "Send magic link"}
					</Button>
				</form>
			</Form>
		</AuthCard>
	)
}
