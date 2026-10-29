import argparse
import base64
import sys

import numpy as np
import sounddevice as sd


def record_phrase(sample_rate: int = 16000) -> np.ndarray | None:
    block_size = 1600
    frames: list[np.ndarray] = []
    ambient: list[float] = []
    heard_speech = False
    silent_blocks = 0
    speech_blocks = 0

    with sd.InputStream(samplerate=sample_rate, channels=1, dtype="float32", blocksize=block_size) as stream:
        for index in range(300):
            block, overflowed = stream.read(block_size)
            if overflowed:
                continue
            mono = block[:, 0].copy()
            rms = float(np.sqrt(np.mean(np.square(mono))))
            if index < 4 and not heard_speech:
                ambient.append(rms)
            noise_floor = float(np.median(ambient)) if ambient else 0.001
            threshold = max(0.0035, noise_floor * 1.7)
            frames.append(mono)

            if rms >= threshold:
                heard_speech = True
                speech_blocks += 1
                silent_blocks = 0
            elif heard_speech:
                silent_blocks += 1

            if not heard_speech and index >= 79:
                return None
            if heard_speech and speech_blocks >= 3 and silent_blocks >= 12:
                break

    if not heard_speech or speech_blocks < 3:
        return None
    return np.concatenate(frames).astype(np.float32)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--language", default="auto")
    parser.add_argument("--model", default="base")
    args = parser.parse_args()

    audio = record_phrase()
    if audio is None:
        return 3

    from faster_whisper import WhisperModel

    model = WhisperModel(args.model, device="cpu", compute_type="int8")
    segments, _ = model.transcribe(
        audio,
        language=None if args.language == "auto" else args.language,
        beam_size=1,
        best_of=1,
        vad_filter=True,
        vad_parameters={"min_silence_duration_ms": 500},
        condition_on_previous_text=False,
    )
    transcript = " ".join(segment.text.strip() for segment in segments if segment.text.strip()).strip()
    if not transcript:
        return 3
    encoded = base64.b64encode(transcript.encode("utf-8")).decode("ascii")
    print(f"TRANSCRIPT:{encoded}", flush=True)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        raise SystemExit(130)
    except Exception as error:
        print(str(error), file=sys.stderr, flush=True)
        raise SystemExit(1)
