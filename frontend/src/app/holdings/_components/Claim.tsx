import ClaimCard from "./ClaimCard";

export default function Claim() {
    return (
        <div className="flex flex-col gap-[10px]">
            <h1 className="text-base font-medium text-white">Claim</h1>
            <div className="flex flex-col gap-2">
                <ClaimCard status="available" amount={100} />
                <ClaimCard status="pending" amount={100} />
            </div>
        </div>
    )
}