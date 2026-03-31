import { GoeyToaster, type GoeyToasterProps } from "goey-toast";

function Toaster({ ...props }: GoeyToasterProps) {
	return <GoeyToaster {...props} />;
}

export { Toaster };
