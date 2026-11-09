type TabsProps<T extends string> = {
  items: readonly T[];
  value: T;
  onChange: (v: T) => void;
  label?: (item: T) => string;
};

export function Tabs<T extends string>({
  items,
  value,
  onChange,
  label,
}: TabsProps<T>) {
  return (
    <div role="tablist" className="hide-scrollbar flex gap-5 overflow-x-auto">
      {items.map((i) => (
        <button
          key={i}
          role="tab"
          aria-selected={value === i}
          onClick={() => onChange(i)}
          className={`shrink-0 whitespace-nowrap border-b-2 pb-1 text-ui-sm focus-visible:outline focus-visible:outline-content ${
            value === i
              ? "border-content text-opposite"
              : "border-transparent text-content-secondary hover:text-opposite"
          }`}
        >
          {label ? label(i) : i}
        </button>
      ))}
    </div>
  );
}
