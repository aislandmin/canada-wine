import { useCallback, useEffect, useState } from 'react';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function parse<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError((data as { error?: string }).error ?? '请求失败，请稍后再试', res.status);
  return data as T;
}

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const method = init.method ?? 'GET';
  // The server requires JSON on every state-changing request (CSRF guard), so always send a body.
  const body = method === 'GET' ? undefined : JSON.stringify(init.body ?? {});
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body,
      credentials: 'same-origin',
    });
  } catch {
    throw new ApiError('网络错误，请检查网络连接', 0);
  }
  return parse<T>(res);
}

/** Upload a raw image file (the server sniffs the real type). */
export async function uploadImage<T>(path: string, blob: Blob): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method: 'POST',
      headers: { 'Content-Type': blob.type || 'image/jpeg' },
      body: blob,
      credentials: 'same-origin',
    });
  } catch {
    throw new ApiError('网络错误，请检查网络连接', 0);
  }
  return parse<T>(res);
}

/** Human-readable message for any thrown value. */
export function errorText(err: unknown, fallback = '操作失败，请稍后再试'): string {
  return err instanceof ApiError ? err.message : fallback;
}

export interface AsyncState<T> {
  data: T | undefined;
  error: ApiError | undefined;
  loading: boolean;
  /** Fetch again (e.g. after saving a change). */
  reload: () => void;
}

/** Fetch `path` on mount and whenever it changes. */
export function useApi<T>(path: string | null): AsyncState<T> {
  const [nonce, setNonce] = useState(0);
  const [state, setState] = useState<Omit<AsyncState<T>, 'reload'>>({
    data: undefined,
    error: undefined,
    loading: !!path,
  });

  useEffect(() => {
    if (!path) return;
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: undefined }));
    api<T>(path)
      .then((data) => !cancelled && setState({ data, error: undefined, loading: false }))
      .catch(
        (err: unknown) =>
          !cancelled &&
          setState({
            data: undefined,
            error: err instanceof ApiError ? err : new ApiError('网络错误，请检查网络连接', 0),
            loading: false,
          }),
      );
    return () => {
      cancelled = true;
    };
  }, [path, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { ...state, reload };
}
