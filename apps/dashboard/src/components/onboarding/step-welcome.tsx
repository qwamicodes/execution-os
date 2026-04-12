import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import { Zap } from "lucide-react";
import { useState } from "react";

interface StepWelcomeProps {
	userName: string;
	onNext: (data: { name: string }) => void;
}

export function StepWelcome({ userName, onNext }: StepWelcomeProps) {
	const [name, setName] = useState(userName);

	return (
		<div className="flex flex-col items-center text-center">
			<div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary">
				<Zap className="h-8 w-8 text-primary-foreground" />
			</div>

			<h1 className="mb-2 text-3xl font-bold tracking-tight">
				Welcome to Execution OS
			</h1>
			<p className="mb-8 max-w-md text-muted-foreground">
				Let&apos;s get you set up in just a few steps. First, confirm your
				display name.
			</p>

			<div className="w-full max-w-sm space-y-4">
				<div className="space-y-2 text-left">
					<Label htmlFor="name">Display name</Label>
					<Input
						id="name"
						value={name}
						onChange={(e) => setName(e.target.value)}
						placeholder="Your name"
					/>
				</div>

				<Button
					className="w-full"
					size="lg"
					onClick={() => onNext({ name: name.trim() || userName })}
				>
					Let&apos;s get started
				</Button>
			</div>
		</div>
	);
}
