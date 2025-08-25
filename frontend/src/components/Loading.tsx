import MillstoneIcon from "public/svgs/MillstoneIcon";
import MillstoneTextIconLoading from "public/svgs/MillstoneTextIconLoading";

export default function Loading() {
  return (
    <div className="flex flex-col h-[100vh] w-[100vw] bg-black gap-[400px] justify-center items-center">
      <MillstoneIcon className="h-[60px] w-[60px]" />
      <MillstoneTextIconLoading className="" />
    </div>
  );
}
