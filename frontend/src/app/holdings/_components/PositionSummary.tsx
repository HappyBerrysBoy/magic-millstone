export default function PositionSummary() {
  return (<>
  <div>
    <h1>Your Position</h1>
    <div>
        <div className="flex flex-col">
            <div>
              <p className="text-[10px] font-normal text-mm-gray-light">$1.39</p>
              <div className="flex items-baseline gap-3 ">
                  <p className="text-base font-normal">$1.39</p>
                  <p className="text-xs font-normal text-mm-gray-default">USD</p>
              </div>
            </div>
            <p className="text-[10px] font-normal text-mm-gray-light">Total value</p>
        </div>
    </div>
  </div>
  </>);
}