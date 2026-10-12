export default function Spinner({ label }: { label: string }) {
  return (
    <div className="loading-container" role="status">
      <div className="loading-spinner" aria-hidden="true" />
      <p>{label}</p>
    </div>
  );
}
