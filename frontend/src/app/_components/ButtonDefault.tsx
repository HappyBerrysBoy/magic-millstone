'use client';

interface ButtonDefaultProps {
  children: React.ReactNode;
  onClick?: () => void;
  theme?: 'primary' | 'outline' | 'secondary';
  disabled?: boolean;
}

export default function ButtonDefault({ children, onClick, theme = 'outline', disabled = false }: ButtonDefaultProps) {
  const getThemeClasses = () => {
    switch (theme) {
      case 'primary':
        return "text-black bg-primary";
      case 'outline':
        return "text-mm-gray-light bg-transparent border-[1px] border-mm-gray-light";
      default:
        return "text-black bg-primary";
    }
  };

  return (
    <button 
      className={`${getThemeClasses()} py-3 rounded-[20px] w-full text-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}