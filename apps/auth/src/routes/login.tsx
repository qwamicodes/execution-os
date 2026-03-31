import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@repo/ui/components/ui/button";
import { Checkbox } from "@repo/ui/components/ui/checkbox";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@repo/ui/components/ui/form";
import { Input } from "@repo/ui/components/ui/input";
import { Separator } from "@repo/ui/components/ui/separator";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { AuthCard } from "../components/auth-card";
import * as api from "../lib/api";
import { redirectToDashboard } from "../lib/auth-store";

const loginSchema = z.object({
	email: z.string().email("Invalid email address"),
	password: z.string().min(1, "Password is required"),
	rememberMe: z.boolean().optional().default(false),
});

type LoginValues = z.infer<typeof loginSchema>;

export const Route = createFileRoute("/login")({
	component: LoginPage,
});

function LoginPage() {
	const form = useForm<LoginValues>({
		resolver: zodResolver(loginSchema),
		defaultValues: { email: "", password: "", rememberMe: false },
	});

	const loginMutation = useMutation({
		mutationFn: (data: LoginValues) => api.login(data),
		onSuccess: () => redirectToDashboard(),
	});

	function onSubmit(data: LoginValues) {
		loginMutation.mutate(data);
	}

	return (
		<AuthCard
			title="Welcome back"
			description="Sign in to your account"
			footer={
				<>
					Don't have an account?{" "}
					<Link to="/register" className="font-medium text-primary underline">
						Sign up
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

					<FormField
						control={form.control}
						name="password"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Password</FormLabel>
								<FormControl>
									<Input
										type="password"
										placeholder="Enter your password"
										{...field}
									/>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>

					<FormField
						control={form.control}
						name="rememberMe"
						render={({ field }) => (
							<FormItem className="flex items-center gap-2">
								<FormControl>
									<Checkbox
										checked={field.value}
										onCheckedChange={field.onChange}
									/>
								</FormControl>
								<FormLabel className="!mt-0 cursor-pointer text-sm font-normal">
									Remember me
								</FormLabel>
							</FormItem>
						)}
					/>

					{loginMutation.error && (
						<p className="text-sm text-destructive">
							{loginMutation.error.message}
						</p>
					)}

					<Button
						type="submit"
						className="w-full"
						disabled={loginMutation.isPending}
					>
						{loginMutation.isPending ? "Signing in..." : "Sign in"}
					</Button>
				</form>
			</Form>

			<div className="my-6 flex items-center gap-3">
				<Separator className="flex-1" />
				<span className="text-xs text-muted-foreground">or continue with</span>
				<Separator className="flex-1" />
			</div>

			<div className="grid grid-cols-2 gap-3">
				<Button variant="outline" asChild>
					<Link to="/otp">Send code</Link>
				</Button>
				<Button variant="outline" asChild>
					<Link to="/magic-link">Magic link</Link>
				</Button>
			</div>
		</AuthCard>
	);
}
