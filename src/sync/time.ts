// Align this device to a shared broadcast time so every viewer is on the same
// moment. Uses Cristian's algorithm against a tiny server time endpoint; falls
// back to the local clock when the endpoint is unavailable (e.g. local dev).

let offsetMs = 0;

export function syncedNow(): number {
  return Date.now() + offsetMs;
}

export function getOffset(): number {
  return offsetMs;
}

interface Sample {
  offset: number;
  rtt: number;
}

export async function syncTime(url = "/time"): Promise<void> {
  const samples: Sample[] = [];
  for (let i = 0; i < 4; i++) {
    try {
      const t0 = Date.now();
      const res = await fetch(url, { cache: "no-store" });
      const t1 = Date.now();
      const body = (await res.json()) as { now?: number };
      if (typeof body.now === "number") {
        samples.push({ offset: body.now + (t1 - t0) / 2 - t1, rtt: t1 - t0 });
      }
    } catch {
      // endpoint unavailable; keep going / fall back
    }
  }
  if (samples.length > 0) {
    samples.sort((a, b) => a.rtt - b.rtt);
    offsetMs = (samples[0] as Sample).offset;
  }
}
