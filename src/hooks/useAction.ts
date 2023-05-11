import React, { useCallback, useEffect, useMemo, useState } from 'react';

async function processData<D, R>(options: {
  signal: AbortSignal;
  data: D;
  handler: (data: D) => Promise<R>;
  setData: React.Dispatch<React.SetStateAction<{ data: D } | undefined>>;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setError: React.Dispatch<React.SetStateAction<Error | undefined>>;
  setResult: React.Dispatch<React.SetStateAction<R | undefined>>;
}) {
  const { data, signal, handler, setData, setLoading, setError, setResult } = options;

  if (!signal.aborted) {
    setLoading(true);
    setError(undefined);
  }

  try {
    const result = await handler(data);

    if (!signal.aborted) {
      setResult(result);
    }
  } catch (e) {
    if (!signal.aborted) {
      setError(e as Error);
    }

    throw e;
  } finally {
    if (!signal.aborted) {
      setLoading(false);
      setData(undefined);
    }
  }
}

export interface ActionResult<R> {
  result?: R;
  error?: Error;
  loading: boolean;
}

export interface ActionReturn<D, R> extends ActionResult<R> {
  data: ActionResult<R>;
  triggerer: (data: D) => void;
  clearResult: () => void;
}

export function useAction<D = void, R = void>(handler: (data: D) => Promise<R>): ActionReturn<D, R> {
  const [data, setData] = useState<{ data: D } | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | undefined>(undefined);
  const [result, setResult] = useState<R | undefined>(undefined);

  const triggerer = useCallback(
    (data: D) => {
      setResult(undefined);
      setLoading(false);
      setError(undefined);
      setData({ data });
    },
    [setData, setResult, setLoading, setError],
  );

  useEffect(() => {
    const abortController = new AbortController();

    if (data) {
      processData<D, R>({
        signal: abortController.signal,
        data: data.data,
        handler,
        setData,
        setLoading,
        setError,
        setResult,
      });
    }

    return () => {
      abortController.abort();
    };
  }, [data, handler, setData, setLoading, setError, setResult]);

  return useMemo(() => {
    return {
      data: { result, error, loading },
      result,
      error,
      loading,
      triggerer,
      clearResult: () => {
        setResult(undefined);
      },
    };
  }, [result, error, loading, triggerer, setResult]);
}
