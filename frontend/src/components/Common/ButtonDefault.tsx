"use client";

interface ButtonDefaultProps {
  children: React.ReactNode;
  onClick?: () => void;
  theme?: "primary" | "outline" | "secondary";
  disabled?: boolean;
}

export default function ButtonDefault({
  children,
  onClick,
  theme = "outline",
  disabled = false,
}: ButtonDefaultProps) {
  const getThemeClasses = () => {
    switch (theme) {
      case "primary":
        return "text-black bg-primary";
      case "outline":
        return "text-mm-gray-light bg-transparent border-[1px] border-mm-gray-light";
      default:
        return "text-black bg-primary";
    }
  };

  return (
    <button
      className={`${getThemeClasses()} w-full cursor-pointer rounded-[20px] py-3 text-sm disabled:cursor-not-allowed disabled:opacity-50`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
