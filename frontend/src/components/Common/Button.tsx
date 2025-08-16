import React from "react";

interface ButtonProps {
  children: React.ReactNode;
  variant?: "primary" | "outline";
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
}

const Button: React.FC<ButtonProps> = ({
  children,
  variant = "primary",
  onClick,
  className = "",
  disabled = false,
  type = "button",
}) => {
  const getVariantClasses = (variant: "primary" | "outline") => {
    switch (variant) {
      case "primary":
        return "bg-primary text-black hover:bg-primary/90";
      case "outline":
        return "bg-black border border-gray text-gray";
      default:
        return "bg-primary text-black hover:bg-primary/90";
    }
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`h-[38px] w-[90%] rounded-full text-[14px] font-medium transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${getVariantClasses(variant)} ${className}`}
    >
      {children}
    </button>
  );
};

export default Button;
