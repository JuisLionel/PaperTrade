type MarketErrorsProps = {
  errors: (string | null)[];
  onRetry: () => void;
};

export default function MarketErrors({ errors, onRetry }: MarketErrorsProps) {
  const message = errors.filter(Boolean).join(" ");
  if (!message) return null;

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 text-ui-sm text-danger">
      <p>{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="btn btn-sm rounded-sm border-elevated bg-surface text-opposite"
      >
        Retry
      </button>
    </div>
  );
}
