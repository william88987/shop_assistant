import { useState, useEffect, useMemo } from "react";
import { storageService, ItemWithPrice } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Trash2, RotateCcw, Edit2, Check, X, PackageOpen } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface EditAutocompleteDialogProps {
  open: boolean;
  onClose: () => void;
  currencySymbol: string;
}

type TabType = "active" | "excluded";

export function EditAutocompleteDialog({ open, onClose, currencySymbol }: EditAutocompleteDialogProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<TabType>("active");
  const [searchQuery, setSearchQuery] = useState("");
  const [allItems, setAllItems] = useState<ItemWithPrice[]>([]);
  const [excludedNames, setExcludedNames] = useState<Set<string>>(new Set());
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState<number>(0);

  // Load data when dialog opens
  useEffect(() => {
    if (open) {
      setAllItems(storageService.getRawItemsWithPrices());
      setExcludedNames(storageService.getAutocompleteExclusions());
      setSearchQuery("");
      setEditingItem(null);
      setActiveTab("active");
    }
  }, [open]);

  // Filtered items based on tab and search
  const filteredItems = useMemo(() => {
    const items = allItems.filter(item => {
      const isExcluded = excludedNames.has(item.name.toLowerCase());
      if (activeTab === "active" && isExcluded) return false;
      if (activeTab === "excluded" && !isExcluded) return false;
      if (searchQuery.trim()) {
        return item.name.toLowerCase().includes(searchQuery.toLowerCase());
      }
      return true;
    });
    return items;
  }, [allItems, excludedNames, activeTab, searchQuery]);

  const activeCount = allItems.filter(item => !excludedNames.has(item.name.toLowerCase())).length;
  const excludedCount = allItems.filter(item => excludedNames.has(item.name.toLowerCase())).length;

  const handleExcludeItem = (itemName: string) => {
    storageService.excludeAutocompleteItem(itemName);
    setExcludedNames(storageService.getAutocompleteExclusions());
    toast({
      title: "Item hidden",
      description: `"${itemName}" removed from autocomplete suggestions.`,
      variant: "default"
    });
  };

  const handleRestoreItem = (itemName: string) => {
    storageService.restoreAutocompleteItem(itemName);
    setExcludedNames(storageService.getAutocompleteExclusions());
    toast({
      title: "Item restored",
      description: `"${itemName}" added back to autocomplete suggestions.`,
      variant: "default"
    });
  };

  const handleStartEditPrice = (item: ItemWithPrice) => {
    setEditingItem(item.name.toLowerCase());
    setEditPrice(item.price);
  };

  const handleSavePrice = (item: ItemWithPrice) => {
    if (editPrice > 0) {
      storageService.saveAutocompletePriceOverride(item.name, editPrice);
      // Reload items to reflect the change
      setAllItems(storageService.getRawItemsWithPrices());
      toast({
        title: "Price updated",
        description: `"${item.name}" price set to ${currencySymbol}${editPrice.toFixed(2)}`,
        variant: "default"
      });
    }
    setEditingItem(null);
  };

  const handleCancelEditPrice = () => {
    setEditingItem(null);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="relative bg-white rounded-lg shadow-lg w-full max-w-md mx-4 flex flex-col" style={{ maxHeight: "85vh" }}>
        {/* Header */}
        <div className="p-5 pb-3 border-b border-gray-100">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-lg font-semibold text-gray-900">Edit Autocomplete Items</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="p-1 h-auto hover:bg-gray-100 rounded-full"
            >
              <X className="h-5 w-5 text-gray-500" />
            </Button>
          </div>
          <p className="text-sm text-gray-500">
            Manage items that appear in autocomplete suggestions.
          </p>

          {/* Tabs */}
          <div className="flex mt-3 bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => { setActiveTab("active"); setSearchQuery(""); }}
              className={`flex-1 py-1.5 px-3 text-sm font-medium rounded-md transition-all ${
                activeTab === "active"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Active ({activeCount})
            </button>
            <button
              onClick={() => { setActiveTab("excluded"); setSearchQuery(""); }}
              className={`flex-1 py-1.5 px-3 text-sm font-medium rounded-md transition-all ${
                activeTab === "excluded"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Hidden ({excludedCount})
            </button>
          </div>

          {/* Search */}
          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Search items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>
        </div>

        {/* Item List */}
        <div className="flex-1 overflow-y-auto min-h-0 p-2">
          {filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-gray-400">
              <PackageOpen className="h-10 w-10 mb-2" />
              <p className="text-sm">
                {searchQuery
                  ? "No items match your search"
                  : activeTab === "excluded"
                  ? "No hidden items"
                  : "No autocomplete items yet"}
              </p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {filteredItems.map((item) => {
                const isEditing = editingItem === item.name.toLowerCase();
                return (
                  <div
                    key={item.name}
                    className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors group"
                  >
                    <div className="flex-1 min-w-0 mr-2">
                      <p className="text-sm font-medium text-gray-800 truncate">{item.name}</p>
                      {isEditing ? (
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="text-xs text-gray-500">{currencySymbol}</span>
                          <Input
                            type="number"
                            step="0.01"
                            min="0.01"
                            value={editPrice || ""}
                            onChange={(e) => setEditPrice(Number(e.target.value))}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleSavePrice(item);
                              if (e.key === "Escape") handleCancelEditPrice();
                            }}
                            className="h-7 w-24 text-xs px-2"
                            autoFocus
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSavePrice(item)}
                            className="p-1 h-auto text-green-600 hover:text-green-700 hover:bg-green-50"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleCancelEditPrice}
                            className="p-1 h-auto text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-xs text-gray-500">
                            {currencySymbol}{item.price.toFixed(2)}
                          </span>
                          {activeTab === "active" && (
                            <button
                              onClick={() => handleStartEditPrice(item)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-gray-400 hover:text-blue-600"
                              title="Edit price"
                            >
                              <Edit2 className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Action button */}
                    {!isEditing && (
                      <div className="flex-shrink-0">
                        {activeTab === "active" ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleExcludeItem(item.name)}
                            className="p-1.5 h-auto text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full"
                            title="Hide from autocomplete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRestoreItem(item.name)}
                            className="p-1.5 h-auto text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-full"
                            title="Restore to autocomplete"
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 pt-3 border-t border-gray-100">
          <Button
            variant="outline"
            onClick={onClose}
            className="w-full"
          >
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
