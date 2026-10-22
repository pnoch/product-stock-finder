import { useNavigate } from "react-router";

export function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center">
      <h1 className="text-2xl font-bold mb-2">Page not found</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">The page you requested does not exist.</p>
      <button
        type="button"
        onClick={() => navigate("/")}
        className="px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors"
      >
        Go to Dashboard
      </button>
    </div>
  );
}
