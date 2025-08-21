const ProfileDefaultIcon = ({ className }: { className?: string }) => {
  return (
    <svg
      width="72"
      height="72"
      viewBox="0 0 72 72"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <circle cx="36" cy="36.0004" r="36" fill="#353939" />
      <path
        d="M36 16.0004L41.0912 30.9092L56 36.0004L41.0912 41.0915L36 56.0004L30.9088 41.0915L16 36.0004L30.9088 30.9092L36 16.0004Z"
        fill="#00E6F2"
      />
    </svg>
  );
};

export default ProfileDefaultIcon;
