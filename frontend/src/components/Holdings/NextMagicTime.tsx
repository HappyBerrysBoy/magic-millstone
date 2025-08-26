import StarIcon from "public/svgs/StarIcon";
import React from "react";

interface NextMagicTimeProps {
  timeLeft: string;
}

const NextMagicTime: React.FC<NextMagicTimeProps> = ({ timeLeft }) => {
  return (
    <>
      <div className="flex-col items-center justify-center gap-[8px]">
        <div className="flex items-center justify-center">
          <StarIcon />
          <div className="text-primary mr-[4px] ml-[6px] text-[12px]">
            Next Magic Time
          </div>
          <StarIcon />
        </div>
        <div className="text-center text-[16px]">{timeLeft}</div>
      </div>
    </>
  );
};

export default NextMagicTime;
