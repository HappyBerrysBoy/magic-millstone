const DatabaseIcon = ({ className }: { className?: string }) => {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        d="M14.75 10V15.625C14.75 17.489 11.7279 19 8 19C4.27208 19 1.25 17.489 1.25 15.625V10M14.75 10V4.375M14.75 10C14.75 11.864 11.7279 13.375 8 13.375C4.27208 13.375 1.25 11.864 1.25 10M14.75 4.375C14.75 2.51104 11.7279 1 8 1C4.27208 1 1.25 2.51104 1.25 4.375M14.75 4.375C14.75 6.23896 11.7279 7.75 8 7.75C4.27208 7.75 1.25 6.23896 1.25 4.375M1.25 10V4.375"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export default DatabaseIcon;
