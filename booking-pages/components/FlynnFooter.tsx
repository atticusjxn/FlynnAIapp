export default function FlynnFooter() {
  return (
    <footer className="bg-white border-t border-gray-200 py-6 mt-12">
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex items-center justify-center space-x-2">
          <span className="text-sm text-gray-600">Powered by</span>
          <a
            href="https://flynnai.app"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center space-x-2 hover:opacity-80 transition-opacity"
          >
            {/* Flynn Logo */}
            <div className="flex items-center">
              <div className="w-6 h-6 bg-primary rounded-md flex items-center justify-center mr-2">
                <svg
                  className="w-4 h-4 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
              </div>
              <span className="text-lg font-bold text-gray-900">Flynn</span>
            </div>
          </a>
        </div>

        <p className="text-xs text-gray-500 text-center mt-2">
          Turn missed calls into booked jobs with AI-powered voicemail reception
        </p>
      </div>
    </footer>
  );
}
