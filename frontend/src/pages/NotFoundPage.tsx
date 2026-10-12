import { Link } from 'react-router';

export default function NotFoundPage() {
  return (
    <div className="page-message">
      <h2>Page not found</h2>
      <p>That page doesn't exist. Try searching for a city instead.</p>
      <Link to="/" className="button">
        Back to search
      </Link>
    </div>
  );
}
