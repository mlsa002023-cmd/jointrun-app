// 44px 최소 터치 타깃(min-h-11)을 항상 보장한다 — 디자인 핸드오프에서 이미 강제되던 규칙.
const VARIANT_CLASSES = {
  primary: "bg-blue-600 text-white",
  outline: "bg-white border border-dashed border-blue-300 text-blue-600",
  ghost: "bg-white border border-slate-200 text-slate-500",
};

function JTButton({ variant = "primary", icon: Icon, disabled = false, className = "", children, ...rest }) {
  return (
    <button
      disabled={disabled}
      className={`w-full min-h-11 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 ${VARIANT_CLASSES[variant]} ${disabled ? "opacity-50 cursor-not-allowed" : ""} ${className}`}
      {...rest}
    >
      {Icon && <Icon className="w-4 h-4" />}
      {children}
    </button>
  );
}

export default JTButton;
