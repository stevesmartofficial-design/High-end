import { PMRecord } from "./data";

type BackendPayload = {
  records?: unknown;
  updatedAt?: string | null;
  error?: string;
  ok?: boolean;
};

async function readPayload(response: Response): Promise<BackendPayload> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as BackendPayload;
  } catch {
    return { error: text };
  }
}

export async function loadRecordsFromBackend(): Promise<{
  ok: boolean;
  records?: PMRecord[];
  updatedAt?: string | null;
  message?: string;
}> {
  try {
    const response = await fetch("/api/pm-records", {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    const payload = await readPayload(response);

    if (!response.ok) {
      return {
        ok: false,
        message: payload.error || `Backend returned ${response.status}`,
      };
    }

    return {
      ok: true,
      records: Array.isArray(payload.records) ? (payload.records as PMRecord[]) : undefined,
      updatedAt: payload.updatedAt ?? null,
    };
  } catch (error) {
    return {
      ok: false,
      message: (error as Error).message || "Backend is not available.",
    };
  }
}

export async function saveRecordsToBackend(records: PMRecord[]): Promise<{
  ok: boolean;
  updatedAt?: string | null;
  message?: string;
}> {
  try {
    const response = await fetch("/api/pm-records", {
      method: "PUT",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ records }),
    });
    const payload = await readPayload(response);

    if (!response.ok) {
      return {
        ok: false,
        message: payload.error || `Backend returned ${response.status}`,
      };
    }

    return {
      ok: true,
      updatedAt: payload.updatedAt ?? null,
    };
  } catch (error) {
    return {
      ok: false,
      message: (error as Error).message || "Backend is not available.",
    };
  }
}