import { Progress } from "@repo/ui/components/ui/progress";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { goeyToast as toast } from "goey-toast";
import { projects, tasks } from "@/lib/api";
import type { Project, ProjectType, User } from "@/lib/types";
import { StepComplete } from "./step-complete";
import { StepProject } from "./step-project";
import { StepTask } from "./step-task";
import { StepWelcome } from "./step-welcome";

interface OnboardingWizardProps {
	user: User;
}

const TOTAL_STEPS = 4;

export function OnboardingWizard({ user }: OnboardingWizardProps) {
	const navigate = useNavigate();
	const [step, setStep] = useState(1);
	const [wizardData, setWizardData] = useState({
		name: user.name,
		project: null as Project | null,
		taskTitle: undefined as string | undefined,
	});

	const createProjectMutation = useMutation({
		mutationFn: projects.create,
		onSuccess: (project) => {
			setWizardData((prev) => ({ ...prev, project }));
			setStep(3);
		},
		onError: (error) => {
			toast.error(error.message);
		},
	});

	const createTaskMutation = useMutation({
		mutationFn: tasks.create,
		onSuccess: (task) => {
			setWizardData((prev) => ({ ...prev, taskTitle: task.title }));
			setStep(4);
		},
		onError: (error) => {
			toast.error(error.message);
		},
	});

	function handleWelcomeNext(data: { name: string }) {
		setWizardData((prev) => ({ ...prev, name: data.name }));
		setStep(2);
	}

	function handleProjectNext(data: {
		name: string;
		type: ProjectType;
		color: string;
	}) {
		createProjectMutation.mutate(data);
	}

	function handleTaskNext(data: { title: string; description?: string }) {
		if (!wizardData.project) return;
		createTaskMutation.mutate({
			title: data.title,
			description: data.description,
			projectId: wizardData.project.id,
		});
	}

	function handleTaskSkip() {
		setStep(4);
	}

	function handleComplete() {
		navigate({ to: "/" });
	}

	const progress = (step / TOTAL_STEPS) * 100;

	return (
		<div className="flex min-h-screen flex-col items-center justify-center p-4">
			{/* Progress bar */}
			<div className="mb-8 w-full max-w-md">
				<div className="mb-2 flex justify-between text-xs text-muted-foreground">
					<span>
						Step {step} of {TOTAL_STEPS}
					</span>
					<span>{Math.round(progress)}%</span>
				</div>
				<Progress value={progress} className="h-1.5" />
			</div>

			{/* Step content */}
			<div className="w-full max-w-lg">
				{step === 1 && (
					<StepWelcome userName={wizardData.name} onNext={handleWelcomeNext} />
				)}

				{step === 2 && (
					<StepProject
						onNext={handleProjectNext}
						onBack={() => setStep(1)}
						isSubmitting={createProjectMutation.isPending}
					/>
				)}

				{step === 3 && wizardData.project && (
					<StepTask
						projectName={wizardData.project.name}
						onNext={handleTaskNext}
						onSkip={handleTaskSkip}
						onBack={() => setStep(2)}
						isSubmitting={createTaskMutation.isPending}
					/>
				)}

				{step === 4 && (
					<StepComplete
						projectName={wizardData.project?.name || ""}
						taskTitle={wizardData.taskTitle}
						onComplete={handleComplete}
					/>
				)}
			</div>
		</div>
	);
}
