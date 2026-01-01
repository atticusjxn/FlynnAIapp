export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full flynn-card text-center">
        <div className="mb-6">
          <span className="text-6xl">🔍</span>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-4">Quote Form Not Found</h1>

        <p className="text-gray-600 mb-6">
          The quote form you&apos;re looking for doesn&apos;t exist or may have been removed.
        </p>

        <p className="text-sm text-gray-500">
          Please check the link you received and try again, or contact the business directly.
        </p>

        <div className="mt-8 pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-500">
            Powered by{' '}
            <a
              href="https://flynnai.app"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-primary hover:underline"
            >
              Flynn AI
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
