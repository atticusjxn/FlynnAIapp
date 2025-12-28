export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-900 mb-4">404</h1>
        <h2 className="text-2xl font-semibold text-gray-700 mb-2">Booking Page Not Found</h2>
        <p className="text-gray-500 mb-8">
          The booking page you're looking for doesn't exist or has been disabled.
        </p>
        <a
          href="https://flynnai.app"
          className="flynn-button-primary inline-block"
        >
          Go to Flynn AI
        </a>
      </div>
    </div>
  );
}
