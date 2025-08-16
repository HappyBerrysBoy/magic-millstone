'use client';

import { useRouter } from 'next/navigation';
import BackIcon from "public/svgs/BackIcon";

interface ButtonBackProps {
  href?: string;
  onClick?: () => void;
  className?: string;
}

export default function ButtonBack({ href, onClick, className }: ButtonBackProps) {
  const router = useRouter();

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else if (href) {
      router.push(href);
    } else {
      router.back();
    }
  };

  return (
    <button onClick={handleClick} className={className}>
      <BackIcon/>
    </button>
  );
}