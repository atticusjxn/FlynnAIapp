interface ProgressBarProps {
  progress: number; // 0-100
  primaryColor: string;
}

export default function ProgressBar({ progress, primaryColor }: ProgressBarProps) {
  return (
    <div className="sticky top-0 z-50 bg-white shadow-sm">
      <div className="flynn-progress-bar">
        <div
          className="flynn-progress-fill"
          style={{
            width: `${progress}%`,
            backgroundColor: primaryColor,
          }}
        />
      </div>
    </div>
  );
}
