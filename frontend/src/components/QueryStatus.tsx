interface QueryStatusProps {
  label: string;
  isPending: boolean;
  error: unknown;
  onRetry: () => void;
}

export default function QueryStatus({ label, isPending, error, onRetry }: QueryStatusProps) {
  if (isPending) {
    return (
      <div className="query-status" role="status">
        <span className="query-spinner" aria-hidden="true" />
        Loading {label}...
      </div>
    );
  }

  if (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return (
      <div className="query-status query-status-error" role="alert">
        <span>
          Failed to load {label}: {detail}
        </span>
        <button type="button" className="secondary-action" onClick={onRetry}>
          Retry
        </button>
      </div>
    );
  }

  return null;
}
