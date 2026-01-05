import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface ItemWithPrice {
  name: string;
  price: number;
}

interface AutocompleteInputProps {
  value: string;
  onChange: (value: string) => void;
  onSelectItem?: (item: ItemWithPrice) => void;
  suggestions: string[];
  itemsWithPrices?: ItemWithPrice[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  currencySymbol?: string;
}

export function AutocompleteInput({
  value,
  onChange,
  onSelectItem,
  suggestions,
  itemsWithPrices,
  placeholder,
  className,
  disabled,
  currencySymbol = "€"
}: AutocompleteInputProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Use itemsWithPrices if provided, otherwise fall back to suggestions
  const itemsList: ItemWithPrice[] = itemsWithPrices || suggestions.map(name => ({ name, price: 0 }));

  // Filter suggestions based on input value
  const filteredItems = itemsList.filter(item =>
    item.name.toLowerCase().includes(value.toLowerCase()) && item.name.toLowerCase() !== value.toLowerCase()
  ).slice(0, 5); // Limit to 5 suggestions

  useEffect(() => {
    setSelectedIndex(-1);
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    setShowSuggestions(newValue.length > 0);
  };

  const handleSelectItem = (item: ItemWithPrice) => {
    onChange(item.name);
    if (onSelectItem && item.price > 0) {
      onSelectItem(item);
    }
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || filteredItems.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < filteredItems.length - 1 ? prev + 1 : 0
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex(prev => 
          prev > 0 ? prev - 1 : filteredItems.length - 1
        );
        break;
      case "Enter":
        e.preventDefault();
        if (selectedIndex >= 0) {
          handleSelectItem(filteredItems[selectedIndex]);
        }
        break;
      case "Escape":
        setShowSuggestions(false);
        setSelectedIndex(-1);
        break;
    }
  };

  const handleBlur = () => {
    // Delay hiding suggestions to allow for clicks
    setTimeout(() => setShowSuggestions(false), 150);
  };

  const handleFocus = () => {
    if (value.length > 0 && filteredItems.length > 0) {
      setShowSuggestions(true);
    }
  };

  return (
    <div className="relative w-full flex-1">
      <Input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        onFocus={handleFocus}
        placeholder={placeholder}
        className={cn("w-full", className)}
        disabled={disabled}
      />
      
      {showSuggestions && filteredItems.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute top-full left-0 right-0 z-50 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto mt-1"
        >
          {filteredItems.map((item, index) => (
            <div
              key={item.name}
              onClick={() => handleSelectItem(item)}
              className={cn(
                "px-4 py-2 cursor-pointer text-sm hover:bg-gray-100 transition-colors flex justify-between items-center",
                index === selectedIndex && "bg-blue-50 text-blue-700"
              )}
            >
              <span>{item.name}</span>
              {item.price > 0 && (
                <span className="text-gray-500 text-xs ml-2">
                  {currencySymbol}{item.price.toFixed(2)}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}