interface BusinessHeaderProps {
  businessName: string;
  logoUrl?: string;
  primaryColor: string;
}

export default function BusinessHeader({
  businessName,
  logoUrl,
  primaryColor,
}: BusinessHeaderProps) {
  return (
    <div className="bg-white border-b border-gray-200">
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center space-x-4">
          {logoUrl && (
            <img
              src={logoUrl}
              alt={`${businessName} logo`}
              className="w-12 h-12 rounded-lg object-cover"
            />
          )}
          <div>
            <h1 className="text-2xl font-bold" style={{ color: primaryColor }}>
              {businessName}
            </h1>
            <p className="text-gray-600 text-sm">Book your appointment</p>
          </div>
        </div>
      </div>
    </div>
  );
}
