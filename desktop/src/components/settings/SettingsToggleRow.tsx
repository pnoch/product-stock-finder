export function SettingsToggleRow({
  label,
  description,
  checked,
  onChange,
  disabled = false,
  ariaLabel,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  ariaLabel: string;
}) {
  return (
    <label
      className={`flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800 -mx-2 px-3 py-2.5 rounded-lg transition-colors ${
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
      }`}
    >
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-gray-500 dark:text-gray-400">{description}</span>
      </span>
      <span className="relative inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          className="sr-only peer"
          aria-label={ariaLabel}
        />
        <span className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-brand-300 dark:peer-focus:ring-brand-800 rounded-full peer peer-checked:bg-brand-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all after:duration-300 peer-checked:after:translate-x-full peer-checked:after:border-white transition-colors duration-300" />
      </span>
    </label>
  );
}
