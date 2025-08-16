import ButtonBack from "@/app/_components/ButtonBack";
import Withdraw from "../_components/Withdraw";
import Claim from "../_components/Claim";

export default function WithdrawPage() {
  return (<div className="flex flex-col gap-[26px]">
    <ButtonBack href="/holdings" />
    <div className="flex flex-col gap-16">
    <Withdraw />
    <Claim />
    </div>
  </div>);
}