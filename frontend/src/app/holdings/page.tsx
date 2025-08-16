import PositionSummary from "./_components/PositionSummary";
import HoldingButtons from "./_components/HoldingButtons";

export default function Holdings(){

  return(<div className="flex flex-col h-full min-h-[calc(100vh-148px)]">
    <div className="flex-1">
      <PositionSummary />
    </div>
    <HoldingButtons />
  </div>)
}