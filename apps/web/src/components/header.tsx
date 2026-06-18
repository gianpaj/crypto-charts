import { ModeToggle } from "./mode-toggle";

export default function Header() {
  return (
    <div className="border-b border-white/10 bg-black">
      <div className="flex flex-row items-center justify-between px-4 py-2">
        <span className="font-semibold tracking-tight">Crypto Charts</span>
        <ModeToggle />
      </div>
    </div>
  );
}
