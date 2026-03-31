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
import { AuthCard } from "../components/auth-card";
import * as api from "../lib/api";
import { redirectToDashboard } from "../lib/auth-store";

const registerSchema = z
	.object({
		name: z.string().min(1, "Name is required").max(100),
		email: z.string().email("Invalid email address"),
		password: z
			.string()
			.min(12, "Password must be at least 12 characters")
			.regex(/[A-Z]/, "Must contain an uppercase letter")
			.regex(/[a-z]/, "Must contain a lowercase letter")
			.regex(/[0-9]/, "Must contain a number")
			.regex(/[^A-Za-z0-9]/, "Must contain a special character"),
		confirmPassword: z.string(),
	})
	.refine((data) => data.password === data.confirmPassword, {
		message: "Passwords don't match",
		path: ["confirmPassword"],
	});

type RegisterValues = z.infer<typeof registerSchema>;

export const Route = createFileRoute("/register")({
	component: RegisterPage,
});

function RegisterPage() {
	const form = useForm<RegisterValues>({
		resolver: zodResolver(registerSchema),
		defaultValues: { name: "", email: "", password: "", confirmPassword: "" },
	});

	const registerMutation = useMutation({
		mutationFn: (data: RegisterValues) =>
			api.register({
				name: data.name,
				email: data.email,
				password: data.password,
			}),
		onSuccess: () => redirectToDashboard(),
	});

	function onSubmit(data: RegisterValues) {
		registerMutation.mutate(data);
	}

	return (
		<AuthCard
			title="Create an account"
			description="Get started with Execution OS"
			footer={
				<>
					Already have an account?{" "}
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
						name="name"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Name</FormLabel>
								<FormControl>
									<Input placeholder="Your name" {...field} />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>

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
										placeholder="Min. 12 characters"
										{...field}
									/>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>

					<FormField
						control={form.control}
						name="confirmPassword"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Confirm password</FormLabel>
								<FormControl>
									<Input
										type="password"
										placeholder="Repeat your password"
										{...field}
									/>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>

					{registerMutation.error && (
						<p className="text-sm text-destructive">
							{registerMutation.error.message}
						</p>
					)}

					<Button
						type="submit"
						className="w-full"
						disabled={registerMutation.isPending}
					>
						{registerMutation.isPending ? "Creating account..." : "Sign up"}
					</Button>
				</form>
			</Form>
		</AuthCard>
	);
}
