import { useSound } from "@repo/ui/hooks/use-sound";
import { errorBuzzSound } from "@repo/ui/lib/error-buzz";
import { iQuestActivateSound } from "@repo/ui/lib/i-quest-activate";
import { iQuestCompleteSound } from "@repo/ui/lib/i-quest-complete";
import { iQuestUpdateSound } from "@repo/ui/lib/i-quest-update";
import { getAudioContext } from "@repo/ui/lib/sound-engine";
import { zapTwoTone2Sound } from "@repo/ui/lib/zap-two-tone-2";

export function useSessionSounds() {
	const [playSessionStart] = useSound(iQuestActivateSound, {
		interrupt: true,
		volume: 0.35,
	});
	const [playSessionPause] = useSound(zapTwoTone2Sound, {
		interrupt: true,
		volume: 0.3,
	});
	const [playSessionResume] = useSound(iQuestUpdateSound, {
		interrupt: true,
		volume: 0.35,
	});
	const [playSessionComplete] = useSound(iQuestCompleteSound, {
		interrupt: true,
		volume: 0.35,
	});
	const [playSessionError] = useSound(errorBuzzSound, {
		interrupt: true,
		volume: 0.45,
	});

	async function primeSessionAudio() {
		try {
			const context = getAudioContext();
			if (context.state === "suspended") {
				await context.resume();
			}
		} catch {
			// no-op: audio may be blocked by browser policy
		}
	}

	return {
		primeSessionAudio,
		playSessionStart,
		playSessionPause,
		playSessionResume,
		playSessionComplete,
		playSessionError,
	};
}
