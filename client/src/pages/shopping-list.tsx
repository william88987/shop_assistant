import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { ShoppingList, ShoppingItem, ShoppingGroup, InsertShoppingItem } from "@shared/schema";
import { storageService } from "@/lib/storage";
import { BinPackingAlgorithm } from "@/lib/bin-packing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AutocompleteInput } from "@/components/autocomplete-input";
import { ShoppingItemComponent } from "@/components/shopping-item";
import { GroupContainer } from "@/components/group-container";
import { QuantityInput } from "@/components/quantity-input";
import { PhotoCapture } from "@/components/photo-capture";
import { WeightEditDialog } from "@/components/weight-edit-dialog";
import { ManualPerKgDialog } from "@/components/manual-perkg-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { ArrowLeft, Plus, Edit2, Check, X, Camera, Tag, Pause, Play, Trash2, Minus, AtSign, Calculator, Percent, Scale, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn, canApplyDiscount, toggleDiscount, calculateItemTotal } from "@/lib/utils";

export default function ShoppingListPage() {
  const [, params] = useRoute("/list/:id");
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [currentList, setCurrentList] = useState<ShoppingList | null>(null);
  const [newItem, setNewItem] = useState<InsertShoppingItem>({
    name: "",
    price: 0,
    quantity: 1,
    discountApplied: false,
    onHold: false,
    isPerKg: false,
    isSplittable: true,
    photo: undefined
  });
  // Replace targetAmount and numberOfGroups state with groupSpecs array
  const [groupSpecs, setGroupSpecs] = useState([{ targetAmount: 25, count: 2 }]);
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ name: string; price: number; quantity: number; discountApplied: boolean; onHold: boolean }>({
    name: "",
    price: 0,
    quantity: 1,
    discountApplied: false,
    onHold: false
  });
  const [showSplitPanel, setShowSplitPanel] = useState<boolean>(false);
  const [editingGroupTarget, setEditingGroupTarget] = useState<string | null>(null);
  const [dragOverGroup, setDragOverGroup] = useState<string | null>(null);
  const [showPhotoCapture, setShowPhotoCapture] = useState<boolean>(false);
  const [photoCaptureKey, setPhotoCaptureKey] = useState<number>(0);
  // Add state for OCR loading text
  const [ocrLoadingText, setOcrLoadingText] = useState<string | null>(null);
  const [ocrIsProcessing, setOcrIsProcessing] = useState(false);
  // Add state for weight edit dialog
  const [showWeightEditDialog, setShowWeightEditDialog] = useState<boolean>(false);
  const [editingPerKgItem, setEditingPerKgItem] = useState<ShoppingItem | null>(null);
  // Add state for manual per-KG dialog
  const [showManualPerKgDialog, setShowManualPerKgDialog] = useState<boolean>(false);
  // Add state for autocomplete suggestions with prices
  const [itemNameSuggestions, setItemNameSuggestions] = useState<string[]>([]);
  const [itemsWithPrices, setItemsWithPrices] = useState<{ name: string; price: number }[]>([]);
  const [isAddingItem, setIsAddingItem] = useState(false);
  // Add state for discard item confirmation dialog
  const [showDiscardItemDialog, setShowDiscardItemDialog] = useState<boolean>(false);
  // Add state for Fill Items feature
  const [showFillItemsPanel, setShowFillItemsPanel] = useState<boolean>(false);
  const [fillTargetAmount, setFillTargetAmount] = useState<number>(50);
  const [fillSelectedItems, setFillSelectedItems] = useState<{ name: string; price: number; quantity: number; selected: boolean }[]>([]);
  
  // For manually added items, we won't fetch images from the web
  // Only items captured via camera will have product images
  // Add state for currency symbol
  const [currencySymbol, setCurrencySymbol] = useState("€");

  useEffect(() => {
    if (params?.id) {
      const list = storageService.getList(params.id);
      if (list) {
        setCurrentList(list);
      } else {
        toast({
          title: "List not found",
          description: "The shopping list you're looking for doesn't exist.",
          variant: "destructive"
        });
        setLocation("/");
      }
    }

    // Load item name suggestions with prices
    setItemNameSuggestions(storageService.getItemNames());
    setItemsWithPrices(storageService.getItemsWithPrices());
    
    // Load currency symbol
    const savedCurrency = localStorage.getItem('currencySymbol') || '€';
    setCurrencySymbol(savedCurrency);
  }, [params?.id, setLocation, toast]);

  const updateList = (updatedList: ShoppingList) => {
    const totalAmount = updatedList.items
      .filter(item => !item.onHold)
      .reduce((sum, item) => sum + item.total, 0);
    updatedList.total = Number(totalAmount.toFixed(2));

    setCurrentList(updatedList);
    storageService.updateList(updatedList);
  };

  // Function to clean item name by removing discount information and weight
  const cleanItemName = (itemName: string): string => {
    // Remove discount patterns like "(3 for €10)", "(3 for 2)", "(Buy 2 get 1)", etc.
    // Also remove weight patterns like "(0.25kg)", "(1.5kg)", etc.
    return itemName
      .replace(/\s*\([^)]*for[^)]*\)/gi, '') // Remove "(X for Y)" patterns
      .replace(/\s*\(buy[^)]*get[^)]*\)/gi, '') // Remove "(buy X get Y)" patterns
      .replace(/\s*\([^)]*€[^)]*\)/gi, '') // Remove any pattern with currency symbols
      .replace(/\s*\([^)]*\$[^)]*\)/gi, '') // Remove any pattern with dollar signs
      .replace(/\s*\([^)]*£[^)]*\)/gi, '') // Remove any pattern with pound signs
      .replace(/\s*\([^)]*¥[^)]*\)/gi, '') // Remove any pattern with yen signs
      .replace(/\s*\([0-9.]+kg\)/gi, '') // Remove weight patterns like "(0.25kg)"
      .trim();
  };

  // Function to handle navigation back
  const handleBackNavigation = () => {
    setLocation("/");
  };

  const addItemToList = async (itemData: InsertShoppingItem) => {
    if (!currentList || !itemData.name.trim() || itemData.price <= 0) {
      toast({
        title: "Invalid item",
        description: "Please enter a valid item name and price.",
        variant: "destructive"
      });
      return;
    }

    setIsAddingItem(true);

    // Use provided photo (only from camera capture)
    const photo = (itemData as any).photo;

    // Apply discount automatically if quantity matches discount requirement
    const discountApplied = itemData.discount ? canApplyDiscount({
      ...itemData,
      discountApplied: false
    } as ShoppingItem) : false;

    const item: ShoppingItem = {
      id: `item-${Date.now()}`,
      name: itemData.name.trim(),
      price: Number(itemData.price),
      quantity: itemData.quantity,
      total: itemData.discount && discountApplied ?
        calculateItemTotal({
          ...itemData,
          discountApplied: true,
          id: `temp-${Date.now()}`,
          total: 0
        } as ShoppingItem) :
        Number((itemData.price * itemData.quantity).toFixed(2)), // For per-KG: per-KG price × weight
      discount: itemData.discount,
      discountApplied,
      onHold: false,
      isPerKg: itemData.isPerKg || false,
      isSplittable: itemData.isSplittable !== false,
      photo: photo // Include the fetched photo thumbnail
    };

    const updatedList = {
      ...currentList,
      items: [...currentList.items, item]
    };

    updateList(updatedList);

    // Save the new item name and price for autocomplete (cleaned)
    // First try the cleaned name, but also save original if cleaning removes too much
    const cleanedName = cleanItemName(itemData.name.trim());
    const originalName = itemData.name.trim()
      .replace(/\s*\([0-9.]+kg\)/gi, '') // Only remove weight patterns for original
      .trim();
    
    const nameToSave = (cleanedName && cleanedName.length > 0) ? cleanedName : originalName;
    if (nameToSave && nameToSave.length > 0) {
      storageService.addItemWithPrice(nameToSave, Number(itemData.price));
    }
    setItemNameSuggestions(storageService.getItemNames());
    setItemsWithPrices(storageService.getItemsWithPrices());

    setNewItem({ name: "", price: 0, quantity: 1, discountApplied: false, onHold: false, isPerKg: false, isSplittable: true, photo: undefined });
    setOcrIsProcessing(false);
    setOcrLoadingText(null);
    (window as any).__ocrLoadingText = null;
    (window as any).__ocrIsProcessing = false;
    setIsAddingItem(false);
  };

  const handleAddItem = async () => {
    await addItemToList(newItem);
  };

  const handleRemoveItem = (itemId: string) => {
    if (!currentList) return;

    const updatedList = {
      ...currentList,
      items: currentList.items.filter(item => item.id !== itemId),
      groups: currentList.groups?.map(group => ({
        ...group,
        items: group.items.filter(item => item.id !== itemId),
        total: Number(group.items
          .filter(item => item.id !== itemId)
          .reduce((sum, item) => sum + item.total, 0)
          .toFixed(2))
      }))
    };

    updateList(updatedList);
  };

  const handleToggleDiscount = (itemId: string) => {
    if (!currentList) return;

    const updatedItems = currentList.items.map(item => {
      if (item.id === itemId) {
        const updatedItem = toggleDiscount(item);
        return updatedItem;
      }
      return item;
    });

    // Also update items in groups
    const updatedGroups = currentList.groups?.map(group => ({
      ...group,
      items: group.items.map(item => {
        if (item.id === itemId) {
          const updatedItem = toggleDiscount(item);
          return updatedItem;
        }
        return item;
      }),
      total: Number(group.items.map(item => {
        if (item.id === itemId) {
          const updatedItem = toggleDiscount(item);
          return updatedItem;
        }
        return item;
      }).reduce((sum, item) => sum + item.total, 0).toFixed(2))
    }));

    const updatedList = {
      ...currentList,
      items: updatedItems,
      groups: updatedGroups,
      total: Number(updatedItems.reduce((sum, item) => sum + item.total, 0).toFixed(2))
    };

    updateList(updatedList);
  };

  const handleToggleHold = (itemId: string) => {
    if (!currentList) return;

    const updatedItems = currentList.items.map(item => {
      if (item.id === itemId) {
        return { ...item, onHold: !item.onHold };
      }
      return item;
    });

    // Also update items in groups
    const updatedGroups = currentList.groups?.map(group => ({
      ...group,
      items: group.items.map(item => {
        if (item.id === itemId) {
          return { ...item, onHold: !item.onHold };
        }
        return item;
      }),
      total: Number(group.items
        .filter(item => !item.onHold || item.id !== itemId)
        .reduce((sum, item) => sum + item.total, 0).toFixed(2))
    }));

    const updatedList = {
      ...currentList,
      items: updatedItems,
      groups: updatedGroups
    };

    updateList(updatedList);
  };

  const handleToggleSplitMode = () => {
    if (!currentList) return;

    const updatedList = {
      ...currentList,
      isSplitMode: !currentList.isSplitMode,
      groups: !currentList.isSplitMode ? [] : currentList.groups
    };

    updateList(updatedList);
  };

  // Fill Items feature - suggest items to reach target amount
  const handleOpenFillItems = () => {
    if (!currentList) return;
    
    // Calculate current total
    const currentTotal = currentList.items
      .filter(item => !item.onHold)
      .reduce((sum, item) => sum + item.total, 0);
    
    // Set default target to current total + 10 (rounded up to nearest 5)
    const suggestedTarget = Math.ceil((currentTotal + 10) / 5) * 5;
    setFillTargetAmount(suggestedTarget);
    
    // Get items from all shopping lists (more reliable than autocomplete)
    const allLists = storageService.getAllLists();
    const itemsMap = new Map<string, { name: string; price: number }>();
    
    // Collect unique items from all lists, keeping the latest price
    allLists.forEach(list => {
      list.items.forEach(item => {
        // Clean the item name (remove weight, discount info)
        const cleanName = item.name
          .replace(/\s*\([^)]*\)/g, '') // Remove parenthetical info
          .trim();
        
        if (cleanName && item.price > 0) {
          // Use lowercase key for deduplication, but keep original casing
          const key = cleanName.toLowerCase();
          // Always update to get the latest price
          itemsMap.set(key, { name: cleanName, price: item.price });
        }
      });
    });
    
    // Filter out items already in current list
    const existingItemNames = new Set(currentList.items.map(item => 
      item.name.toLowerCase().replace(/\s*\([^)]*\)/g, '').trim()
    ));
    
    const availableItems = Array.from(itemsMap.values())
      .filter(item => !existingItemNames.has(item.name.toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(item => ({
        name: item.name,
        price: item.price,
        quantity: 1,
        selected: false
      }));
    
    setFillSelectedItems(availableItems);
    setShowFillItemsPanel(true);
  };

  const handleFillItemToggle = (index: number) => {
    setFillSelectedItems(prev => prev.map((item, i) => 
      i === index ? { ...item, selected: !item.selected } : item
    ));
  };

  const handleFillItemQuantityChange = (index: number, quantity: number) => {
    if (quantity < 1) return;
    setFillSelectedItems(prev => prev.map((item, i) => 
      i === index ? { ...item, quantity } : item
    ));
  };

  const getFillItemsTotal = () => {
    return fillSelectedItems
      .filter(item => item.selected)
      .reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  const getCurrentListTotal = () => {
    if (!currentList) return 0;
    return currentList.items
      .filter(item => !item.onHold)
      .reduce((sum, item) => sum + item.total, 0);
  };

  const handleAddFillItems = async () => {
    const selectedItems = fillSelectedItems.filter(item => item.selected);
    if (selectedItems.length === 0) {
      toast({
        title: "No items selected",
        description: "Please select at least one item to add.",
        variant: "destructive"
      });
      return;
    }

    // Add each selected item to the list
    for (const item of selectedItems) {
      const itemData: InsertShoppingItem = {
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        discountApplied: false,
        onHold: false,
        isPerKg: false,
        isSplittable: true
      };
      await addItemToList(itemData);
    }

    setShowFillItemsPanel(false);
    toast({
      title: "Items added",
      description: `Added ${selectedItems.length} item${selectedItems.length > 1 ? 's' : ''} to your list.`
    });
  };

  // Auto-suggest items to fill the gap
  const getSuggestedFillItems = () => {
    const currentTotal = getCurrentListTotal();
    const gap = fillTargetAmount - currentTotal;
    
    if (gap <= 0) return [];
    
    // Find items that could help fill the gap (sorted by how close they are to filling it)
    const availableItems = fillSelectedItems
      .filter(item => !item.selected && item.price <= gap)
      .sort((a, b) => b.price - a.price); // Prefer higher-priced items to minimize count
    
    return availableItems.slice(0, 5); // Return top 5 suggestions
  };

  // Update handleRunBinPacking to use groupSpecs and call the new bin-packing logic
  const handleRunBinPacking = () => {
    if (!currentList || currentList.items.length === 0) {
      toast({
        title: "No items",
        description: "Add some items before splitting the list.",
        variant: "destructive"
      });
      return;
    }
    // Filter out items that are on hold (but include per-KG items as whole units)
    const itemsToSplit = currentList.items.filter(item => !item.onHold);

    if (itemsToSplit.length === 0) {
      toast({
        title: "No items to split",
        description: "All items are on hold. Unhold some items before splitting.",
        variant: "destructive"
      });
      return;
    }
    // Validate groupSpecs
    if (groupSpecs.length === 0 || groupSpecs.some(spec => spec.count < 1 || spec.targetAmount <= 0)) {
      toast({
        title: "Invalid group specs",
        description: "Please enter valid group totals and counts.",
        variant: "destructive"
      });
      return;
    }
    // Sort groupSpecs by targetAmount descending for better bin-packing
    const sortedSpecs = [...groupSpecs].sort((a, b) => b.targetAmount - a.targetAmount);
    const groups = BinPackingAlgorithm.optimizeMultiple(itemsToSplit, sortedSpecs);
    const updatedList = {
      ...currentList,
      groups,
      isSplitMode: true
    };
    updateList(updatedList);
    setShowSplitPanel(false);
    toast({
      title: "List split successfully",
      description: `Items have been distributed into ${groups.length} groups.`
    });
  };

  const handleUpdateGroupTarget = (groupId: string, newTarget: number) => {
    if (!currentList || !currentList.groups) return;

    const updatedGroups = currentList.groups.map(group =>
      group.id === groupId
        ? { ...group, targetAmount: newTarget }
        : group
    );

    const updatedList = {
      ...currentList,
      groups: updatedGroups
    };

    updateList(updatedList);
    setEditingGroupTarget(null);
  };

  const handleEditItem = (item: ShoppingItem) => {
    if (item.isPerKg) {
      // For per-KG items, show weight edit dialog
      setEditingPerKgItem(item);
      setShowWeightEditDialog(true);
    } else {
      // For regular items, show normal edit form
      setEditingItem(item.id);
      setEditForm({
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        discountApplied: item.discountApplied,
        onHold: item.onHold
      });
    }
  };

  const handleSaveEdit = (itemId: string) => {
    if (!currentList) return;

    // Check if quantity is less than 1, if so, remove the item
    if (editForm.quantity < 1) {
      handleRemoveItem(itemId);
      setEditingItem(null);
      toast({
        title: "Item removed",
        description: "Item was removed because quantity was set below 1.",
        variant: "default"
      });
      return;
    }

    const updatedItems = currentList.items.map(item => {
      if (item.id === itemId) {
        // Create updated item with new values
        const updatedItem: ShoppingItem = {
          ...item,
          name: editForm.name,
          price: editForm.price,
          quantity: editForm.quantity
        };

        // Check if discount should be automatically applied based on new quantity
        let discountApplied = item.discountApplied;
        if (item.discount) {
          const shouldApplyDiscount = canApplyDiscount(updatedItem);
          discountApplied = shouldApplyDiscount;

          // Show toast notification if discount status changed
          if (shouldApplyDiscount && !item.discountApplied) {
            toast({
              title: "Discount Applied!",
              description: `Quantity ${editForm.quantity} meets the discount criteria.`,
              variant: "default"
            });
          } else if (!shouldApplyDiscount && item.discountApplied) {
            toast({
              title: "Discount Removed",
              description: `Quantity ${editForm.quantity} no longer meets the discount criteria.`,
              variant: "default"
            });
          }
        }

        // Apply the discount status and calculate total
        const finalItem = {
          ...updatedItem,
          discountApplied
        };

        const newTotal = calculateItemTotal(finalItem);

        return {
          ...finalItem,
          total: newTotal
        };
      }
      return item;
    });

    // Also update item in groups if it exists
    const updatedGroups = currentList.groups?.map(group => ({
      ...group,
      items: group.items.map(item => {
        if (item.id === itemId) {
          // Create updated item with new values
          const updatedItem: ShoppingItem = {
            ...item,
            price: editForm.price,
            quantity: editForm.quantity
          };

          // Check if discount should be automatically applied based on new quantity
          let discountApplied = item.discountApplied;
          if (item.discount) {
            const shouldApplyDiscount = canApplyDiscount(updatedItem);
            discountApplied = shouldApplyDiscount;
          }

          // Apply the discount status and calculate total
          const finalItem = {
            ...updatedItem,
            discountApplied
          };

          const newTotal = calculateItemTotal(finalItem);

          return {
            ...finalItem,
            total: newTotal
          };
        }
        return item;
      }),
      total: Number(group.items.map(item => {
        if (item.id === itemId) {
          // Create updated item with new values
          const updatedItem: ShoppingItem = {
            ...item,
            price: editForm.price,
            quantity: editForm.quantity
          };

          // Check if discount should be automatically applied based on new quantity
          let discountApplied = item.discountApplied;
          if (item.discount) {
            const shouldApplyDiscount = canApplyDiscount(updatedItem);
            discountApplied = shouldApplyDiscount;
          }

          // Apply the discount status and calculate total
          const finalItem = {
            ...updatedItem,
            discountApplied
          };

          return calculateItemTotal(finalItem);
        }
        return item.total;
      }).reduce((sum, total) => sum + total, 0).toFixed(2))
    }));

    const updatedList = {
      ...currentList,
      items: updatedItems,
      groups: updatedGroups
    };

    updateList(updatedList);

    // Save the edited item name and price for autocomplete (cleaned)
    const cleanedName = cleanItemName(editForm.name.trim());
    const originalName = editForm.name.trim()
      .replace(/\s*\([0-9.]+kg\)/gi, '') // Only remove weight patterns for original
      .trim();
    
    const nameToSave = (cleanedName && cleanedName.length > 0) ? cleanedName : originalName;
    if (nameToSave && nameToSave.length > 0) {
      storageService.addItemWithPrice(nameToSave, Number(editForm.price));
    }
    setItemNameSuggestions(storageService.getItemNames());
    setItemsWithPrices(storageService.getItemsWithPrices());

    setEditingItem(null);
  };

  const handleCancelEdit = () => {
    setEditingItem(null);
  };

  const handleWeightEditConfirm = (productName: string, pricePerKg: number, weight: number, newTotal: number) => {
    if (!currentList || !editingPerKgItem) return;

    const newName = `${productName} (${weight}kg)`;

    // Calculate the correct total: per-KG price × weight
    const calculatedTotal = Number((pricePerKg * weight).toFixed(2));

    const updatedItems = currentList.items.map(item => {
      if (item.id === editingPerKgItem.id) {
        return {
          ...item,
          name: newName,
          price: pricePerKg, // Update the per-KG price
          quantity: weight,
          total: calculatedTotal
        };
      }
      return item;
    });

    // Also update item in groups if it exists
    const updatedGroups = currentList.groups?.map(group => ({
      ...group,
      items: group.items.map(item => {
        if (item.id === editingPerKgItem.id) {
          return {
            ...item,
            name: newName,
            price: pricePerKg, // Update the per-KG price in groups too
            quantity: weight,
            total: calculatedTotal
          };
        }
        return item;
      }),
      total: Number(group.items.map(item => {
        if (item.id === editingPerKgItem.id) {
          return calculatedTotal;
        }
        return item.total;
      }).reduce((sum, total) => sum + total, 0).toFixed(2))
    }));

    const updatedList = {
      ...currentList,
      items: updatedItems,
      groups: updatedGroups
    };

    updateList(updatedList);
    
    // Save the cleaned product name and price (without weight) for autocomplete
    const cleanedName = cleanItemName(productName.trim());
    const originalName = productName.trim();
    
    const nameToSave = (cleanedName && cleanedName.length > 0) ? cleanedName : originalName;
    if (nameToSave && nameToSave.length > 0) {
      storageService.addItemWithPrice(nameToSave, pricePerKg);
    }
    setItemNameSuggestions(storageService.getItemNames());
    setItemsWithPrices(storageService.getItemsWithPrices());
    
    setShowWeightEditDialog(false);
    setEditingPerKgItem(null);
  };

  const handleWeightEditCancel = () => {
    setShowWeightEditDialog(false);
    setEditingPerKgItem(null);
  };

  const handleManualPerKgConfirm = async (productName: string, pricePerKg: number, weight: number) => {
    const displayName = `${productName} (${weight}kg)`;
    
    const itemData = {
      name: displayName,
      price: pricePerKg, // Store per-KG price as unit price
      quantity: weight, // Store weight as quantity
      discount: undefined,
      discountApplied: false,
      onHold: false,
      isPerKg: true,
      isSplittable: false,
      photo: undefined // No photo for manually added items
    };

    await addItemToList(itemData);
    
    // Save the cleaned product name and price (without weight) for autocomplete
    const cleanedName = cleanItemName(productName.trim());
    const originalName = productName.trim();
    
    const nameToSave = (cleanedName && cleanedName.length > 0) ? cleanedName : originalName;
    if (nameToSave && nameToSave.length > 0) {
      storageService.addItemWithPrice(nameToSave, pricePerKg);
    }
    setItemNameSuggestions(storageService.getItemNames());
    setItemsWithPrices(storageService.getItemsWithPrices());
    
    // Clear the main form since we used its values for the per-KG item
    setNewItem({ name: "", price: 0, quantity: 1, discountApplied: false, onHold: false, isPerKg: false, isSplittable: true, photo: undefined });
    
    setShowManualPerKgDialog(false);
  };

  const handleManualPerKgCancel = () => {
    setShowManualPerKgDialog(false);
  };

  const handleQuantityChange = (itemId: string, newQuantity: number) => {
    if (!currentList) return;

    // Find the item to check if it's per-KG
    const item = currentList.items.find(i => i.id === itemId);
    if (item?.isPerKg) {
      // For per-KG items, redirect to weight edit dialog instead of using quantity buttons
      handleEditItem(item);
      return;
    }

    // If quantity is 0 or less, remove the item
    if (newQuantity <= 0) {
      handleRemoveItem(itemId);
      toast({
        title: "Item removed",
        description: "Item was removed because quantity reached 0.",
        variant: "default"
      });
      return;
    }

    const updatedItems = currentList.items.map(item => {
      if (item.id === itemId) {
        // Create updated item with new quantity
        const updatedItem: ShoppingItem = {
          ...item,
          quantity: newQuantity
        };

        // Check if discount should be automatically applied based on new quantity
        let discountApplied = item.discountApplied;
        if (item.discount) {
          const shouldApplyDiscount = canApplyDiscount(updatedItem);
          discountApplied = shouldApplyDiscount;

          // Show toast notification if discount status changed
          if (shouldApplyDiscount && !item.discountApplied) {
            toast({
              title: "Discount Applied!",
              description: `Quantity ${newQuantity} meets the discount criteria.`,
              variant: "default"
            });
          } else if (!shouldApplyDiscount && item.discountApplied) {
            toast({
              title: "Discount Removed",
              description: `Quantity ${newQuantity} no longer meets the discount criteria.`,
              variant: "default"
            });
          }
        }

        // Apply the discount status and calculate total
        const finalItem = {
          ...updatedItem,
          discountApplied
        };

        const newTotal = calculateItemTotal(finalItem);

        return {
          ...finalItem,
          total: newTotal
        };
      }
      return item;
    });

    // Also update item in groups if it exists
    const updatedGroups = currentList.groups?.map(group => ({
      ...group,
      items: group.items.map(item => {
        if (item.id === itemId) {
          // Create updated item with new quantity
          const updatedItem: ShoppingItem = {
            ...item,
            quantity: newQuantity
          };

          // Check if discount should be automatically applied based on new quantity
          let discountApplied = item.discountApplied;
          if (item.discount) {
            const shouldApplyDiscount = canApplyDiscount(updatedItem);
            discountApplied = shouldApplyDiscount;
          }

          // Apply the discount status and calculate total
          const finalItem = {
            ...updatedItem,
            discountApplied
          };

          const newTotal = calculateItemTotal(finalItem);

          return {
            ...finalItem,
            total: newTotal
          };
        }
        return item;
      }),
      total: Number(group.items.map(item => {
        if (item.id === itemId) {
          // Create updated item with new quantity
          const updatedItem: ShoppingItem = {
            ...item,
            quantity: newQuantity
          };

          // Check if discount should be automatically applied based on new quantity
          let discountApplied = item.discountApplied;
          if (item.discount) {
            const shouldApplyDiscount = canApplyDiscount(updatedItem);
            discountApplied = shouldApplyDiscount;
          }

          // Apply the discount status and calculate total
          const finalItem = {
            ...updatedItem,
            discountApplied
          };

          return calculateItemTotal(finalItem);
        }
        return item.total;
      }).reduce((sum, total) => sum + total, 0).toFixed(2))
    }));

    const updatedList = {
      ...currentList,
      items: updatedItems,
      groups: updatedGroups
    };

    updateList(updatedList);
  };

  const scrollToAddForm = () => {
    document.querySelector('.add-item-form')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleDragStart = (e: React.DragEvent, item: ShoppingItem) => {
    e.dataTransfer.setData("text/plain", item.id);
    e.dataTransfer.setData("application/json", JSON.stringify(item));
  };
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };
  const handleDragLeave = (e: React.DragEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setDragOverGroup(null);
    }
  };
  const handleGroupDragOver = (groupId: string) => {
    setDragOverGroup(groupId);
  };
  const handleDropOnGroup = (groupId: string, droppedItem: ShoppingItem) => {
    if (!currentList || !currentList.groups) return;
    // Remove item from all groups first
    const updatedGroups = currentList.groups.map(group => ({
      ...group,
      items: group.items.filter(item => item.id !== droppedItem.id),
      total: Number(group.items
        .filter(item => item.id !== droppedItem.id)
        .reduce((sum, item) => sum + item.total, 0)
        .toFixed(2))
    }));
    // Add item to target group
    const targetGroupIndex = updatedGroups.findIndex(group => group.id === groupId);
    if (targetGroupIndex >= 0) {
      updatedGroups[targetGroupIndex].items.push(droppedItem);
      updatedGroups[targetGroupIndex].total = Number(
        (updatedGroups[targetGroupIndex].total + droppedItem.total).toFixed(2)
      );
    }
    const updatedList = {
      ...currentList,
      groups: updatedGroups
    };
    updateList(updatedList);
    setDragOverGroup(null);
  };

  const handlePhotoExtractData = async (productName: string, price: number, discount?: { type: "bulk_price" | "buy_x_get_y"; quantity: number; value: number; display: string }, isPerKg?: boolean, weight?: number, photo?: string) => {
    setOcrIsProcessing(false);
    setOcrLoadingText(null);
    // Clear global window variables
    (window as any).__ocrLoadingText = null;
    (window as any).__ocrIsProcessing = false;

    // Add discount information to product name if detected
    let displayName = productName.trim();
    if (discount) {
      displayName += ` ${discount.display}`;
    }
    if (isPerKg && weight) {
      displayName += ` (${weight}kg)`;
    }

    const itemData = {
      name: displayName || "", // If no product name found, keep it empty
      price: price, // For per-KG items, this is the per-KG price
      quantity: discount ? discount.quantity : (weight || 1), // Use weight as quantity for per-KG items
      discount: discount,
      discountApplied: false,
      onHold: false,
      isPerKg: isPerKg || false,
      isSplittable: !isPerKg, // Per-KG items are not splittable
      photo: photo // Add the captured photo thumbnail
    };

    setNewItem(itemData);

    // Auto-add per-KG items after weight confirmation
    if (isPerKg && weight && productName.trim() && price > 0) {
      // Directly add the item to the list
      await addItemToList(itemData);
    } else {
      // Auto-focus on the appropriate field based on what's missing
      setTimeout(() => {
        const isNameUnknown = !productName.trim() || productName.trim().toLowerCase() === 'unknown';
        if (isNameUnknown) {
          // Focus on item name field if name is unknown
          const nameInput = document.querySelector('.add-item-form input[placeholder*="Item name"]') as HTMLInputElement;
          if (nameInput) {
            nameInput.focus();
          }
        } else if (price <= 0) {
          // Focus on price field if price is unknown
          const priceInput = document.querySelector('.add-item-form input[type="number"][placeholder*="0.00"]') as HTMLInputElement;
          if (priceInput) {
            priceInput.focus();
          }
        }
      }, 100);
    }
    // Removed toast notification to prevent blocking dialog
  };

  // Add a useEffect to load groupSpecs from localStorage when the list is opened
  useEffect(() => {
    if (currentList?.id) {
      const savedSpecs = localStorage.getItem(`splitConfig-${currentList.id}`);
      if (savedSpecs) {
        try {
          setGroupSpecs(JSON.parse(savedSpecs));
        } catch { }
      }
    }
    // eslint-disable-next-line
  }, [currentList?.id]);
  // Add a useEffect to save groupSpecs to localStorage whenever it changes
  useEffect(() => {
    if (currentList?.id) {
      localStorage.setItem(`splitConfig-${currentList.id}`, JSON.stringify(groupSpecs));
    }
  }, [groupSpecs, currentList?.id]);

  // Listen for loadingText and isProcessing from PhotoCapture
  useEffect(() => {
    const interval = setInterval(() => {
      setOcrLoadingText((window as any).__ocrLoadingText || null);
      setOcrIsProcessing((window as any).__ocrIsProcessing || false);
    }, 200);
    return () => clearInterval(interval);
  }, []);

  if (!currentList) {
    return (
      <div className="max-w-md mx-auto bg-white min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  const unassignedItems = currentList.isSplitMode && currentList.groups
    ? currentList.items.filter(item => {
      // For per-KG items (non-splittable), check if the whole item is in any group
      if (!item.isSplittable) {
        const isInGroups = currentList.groups?.some(group => 
          group.items.some(groupItem => groupItem.id === item.id)
        ) || false;
        return !isInGroups;
      }

      // For splittable items, check if the total quantity is fully represented in groups
      const totalInGroups = currentList.groups?.reduce((total, group) => {
        const matchingItems = group.items.filter(groupItem =>
          groupItem.id.startsWith(item.id + '-') || groupItem.id === item.id
        );
        return total + matchingItems.reduce((sum, matchingItem) => sum + matchingItem.quantity, 0);
      }, 0) || 0;

      // Item is unassigned if its total quantity is not fully represented in groups
      return totalInGroups < item.quantity;
    })
    : currentList.items;

  return (
    <div className="max-w-md mx-auto bg-white min-h-screen">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBackNavigation}
              className="mr-3 p-2 hover:bg-gray-100"
            >
              <ArrowLeft className="h-4 w-4 text-gray-600" />
            </Button>
            <div>
              <h1 className="text-lg font-bold text-gray-900">{currentList.name}</h1>
              <p className="text-sm text-gray-600">
                {new Date(currentList.date).toLocaleDateString()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/ask-ai")}
              className="p-2 hover:bg-blue-50"
              title="Ask AI"
            >
              <Sparkles className="h-5 w-5 text-blue-600" />
            </Button>
            <div className="text-right">
              <p className="text-xl font-bold text-blue-600">{currencySymbol}{currentList.total.toFixed(2)}</p>
              <p className="text-xs text-gray-500">{currentList.items.length} items</p>
            </div>
          </div>
        </div>
      </div>

      {/* Add Item Form */}
      <div className="add-item-form bg-white p-4 w-full">
        <div className="space-y-3 w-full">
          {/* Item name field and camera - full width row */}
          <div className="flex gap-1 w-full items-stretch">
            <div className="flex-1 min-w-0">
              <AutocompleteInput
                value={newItem.name}
                onChange={(value) => setNewItem(prev => ({ ...prev, name: value }))}
                onSelectItem={(item) => setNewItem(prev => ({ ...prev, name: item.name, price: item.price }))}
                suggestions={itemNameSuggestions}
                itemsWithPrices={itemsWithPrices}
                placeholder={ocrIsProcessing ? (ocrLoadingText || "Loading...") : "Item name"}
                className="w-full px-4 py-3 text-base"
                disabled={ocrIsProcessing}
                currencySymbol={currencySymbol}
              />
            </div>
            <Button
              onClick={() => setShowManualPerKgDialog(true)}
              variant="outline"
              className="px-3 py-3 flex items-center justify-center w-12 shrink-0 hover:bg-green-50 hover:border-green-300 text-gray-600 hover:text-green-600"
              title="Add per-KG item manually"
            >
              <Scale className="h-4 w-4" />
            </Button>
            <Button
              onClick={() => {
                // Check if there's existing item data that would be discarded
                if (newItem.name.trim()) {
                  setShowDiscardItemDialog(true);
                } else {
                  setPhotoCaptureKey(prev => prev + 1);
                  setShowPhotoCapture(true);
                  setNewItem({ name: "", price: 0, quantity: 1, discountApplied: false, onHold: false, isPerKg: false, isSplittable: true, photo: undefined });
                }
              }}
              variant="outline"
              className="px-3 py-3 flex items-center justify-center w-12 shrink-0 hover:bg-blue-50 hover:border-blue-300 text-gray-600 hover:text-blue-600"
              title="Capture price tag with camera"
            >
              <Camera className="h-4 w-4" />
            </Button>
          </div>
          {/* Price, quantity, and add button */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-base">{currencySymbol}</span>
              <Input
                type="number"
                inputMode="decimal"
                value={newItem.price || ""}
                onChange={(e) => setNewItem(prev => ({ ...prev, price: Number(e.target.value) }))}
                placeholder="0.00"
                step="0.01"
                className="w-full pl-7 pr-2 py-3 text-base"
              />
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-sm text-gray-600 font-medium">Qty:</span>
              <QuantityInput
                value={newItem.quantity}
                onChange={(value) => setNewItem(prev => ({ ...prev, quantity: value }))}
                className="w-32"
              />
            </div>
            {newItem.price > 0 && newItem.quantity > 0 && (
              <div className="flex items-center px-2 bg-blue-50 rounded-md shrink-0">
                <span className="text-sm font-medium text-blue-600">
                  {currencySymbol}{calculateItemTotal({
                    ...newItem,
                    id: 'preview',
                    total: 0,
                    discountApplied: newItem.discount ? canApplyDiscount({
                      ...newItem,
                      id: 'preview',
                      total: 0,
                      discountApplied: false
                    } as ShoppingItem) : false
                  } as ShoppingItem).toFixed(2)}
                </span>
              </div>
            )}
            <Button
              onClick={handleAddItem}
              disabled={isAddingItem}
              className="bg-primary text-white hover:bg-blue-800 px-4 py-3 flex items-center justify-center min-w-[44px] shrink-0 disabled:opacity-50"
            >
              {isAddingItem ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Plus className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>
      </div>



      {/* Items List / Groups */}
      <div className="flex-1 overflow-y-auto pb-24">
        {currentList.isSplitMode ? (
          <div className="px-4 pt-0 pb-8 space-y-4">
            {currentList.groups?.map((group) => (
              <GroupContainer
                key={group.id}
                group={group}
                onItemRemove={handleRemoveItem}
                onDrop={handleDropOnGroup}
                onDragOver={(e) => {
                  e.preventDefault();
                  handleGroupDragOver(group.id);
                }}
                onDragLeave={handleDragLeave}
                onDragStart={handleDragStart}
                onUpdateTarget={handleUpdateGroupTarget}
                editingGroupTarget={editingGroupTarget}
                setEditingGroupTarget={setEditingGroupTarget}
                isDragOver={dragOverGroup === group.id}
              />
            ))}

            {unassignedItems.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-2">Unassigned Items</h3>
                <div className="space-y-2">
                  {unassignedItems.map((item) => {
                    // Calculate how many units are already assigned to groups
                    const assignedQuantity = currentList.groups?.reduce((total, group) => {
                      const matchingItems = group.items.filter(groupItem =>
                        groupItem.id.startsWith(item.id + '-') || groupItem.id === item.id
                      );
                      return total + matchingItems.reduce((sum, matchingItem) => sum + matchingItem.quantity, 0);
                    }, 0) || 0;

                    const remainingQuantity = item.quantity - assignedQuantity;
                    const unitPrice = item.price;

                    // Create individual draggable units for remaining quantity with proper numbering
                    return Array.from({ length: remainingQuantity }, (_, index) => {
                      const actualIndex = assignedQuantity + index + 1; // Start from where we left off
                      const unitItem: ShoppingItem = {
                        ...item,
                        id: `${item.id}-unassigned-${index}`,
                        quantity: 1,
                        total: unitPrice,
                        originalQuantity: item.quantity,
                        splitIndex: actualIndex
                      };

                      return (
                        <div
                          key={`${item.id}-unassigned-${index}`}
                          draggable
                          onDragStart={(e) => handleDragStart(e, unitItem)}
                          className="bg-white border border-yellow-300 rounded px-1.5 py-1 cursor-move hover:bg-yellow-50 transition-colors"
                        >
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-1.5 flex-1">
                              {item.photo && (
                                <img 
                                  src={item.photo} 
                                  alt="Item photo" 
                                  className="w-8 h-8 rounded object-cover border border-gray-200 flex-shrink-0"
                                />
                              )}
                              <span className="font-medium text-gray-900">
                                {item.name} ({actualIndex}/{item.quantity})
                              </span>
                            </div>
                            <span className="text-blue-600 font-medium">{currencySymbol}{unitPrice.toFixed(2)}</span>
                          </div>
                        </div>
                      );
                    });
                  }).flat()}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="px-4 pt-0 pb-8">
            {currentList.items.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No items in this list yet</p>
                <p className="text-sm">Add some items to get started</p>
              </div>
            ) : (
              currentList.items.map((item) => (
                editingItem === item.id ? (
                  <div key={item.id} className="bg-white border border-gray-200 rounded-lg p-3 mb-2 shadow-sm">
                    <div className="space-y-2">
                      <div className="font-medium text-gray-900">
                        <AutocompleteInput
                          value={editForm.name || ""}
                          onChange={(value) => setEditForm(prev => ({ ...prev, name: value }))}
                          onSelectItem={(item) => setEditForm(prev => ({ ...prev, name: item.name, price: item.price }))}
                          suggestions={itemNameSuggestions}
                          itemsWithPrices={itemsWithPrices}
                          placeholder="Item name"
                          className="w-full px-4 py-3 text-base"
                          currencySymbol={currencySymbol}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">{currencySymbol}</span>
                          <Input
                            type="number"
                            inputMode="decimal"
                            value={editForm.price}
                            onChange={(e) => setEditForm(prev => ({ ...prev, price: Number(e.target.value) }))}
                            placeholder="0.00"
                            step="0.01"
                            className="w-full pl-6 pr-2 py-2 text-base"
                          />
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-xs text-gray-600 font-medium">Qty:</span>
                          <QuantityInput
                            value={editForm.quantity}
                            onChange={(value) => setEditForm(prev => ({ ...prev, quantity: value }))}
                            className="w-32"
                          />
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button
                            size="sm"
                            onClick={() => handleSaveEdit(item.id)}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-2 py-2 min-w-[36px]"
                          >
                            <Check className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={handleCancelEdit}
                            className="text-gray-600 hover:bg-gray-100 px-2 py-2 min-w-[36px]"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div key={item.id} className={cn(
                    "bg-white border border-gray-200 rounded-lg p-3 mb-2 shadow-sm",
                    item.onHold && "bg-gray-100 opacity-60"
                  )}>
                    <div>
                      <div className="flex items-center gap-2 w-full">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditItem(item)}
                          className="text-blue-600 hover:bg-blue-50 p-1"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <h4 className={cn(
                          "font-medium flex-1",
                          item.onHold ? "text-gray-500" : "text-gray-900"
                        )}>{item.name}</h4>
                        {item.photo && (
                          <img 
                            src={item.photo} 
                            alt="Item photo" 
                            className="w-12 h-12 rounded-lg object-cover border border-gray-200 -m-1 flex-shrink-0 shadow-sm"
                          />
                        )}
                      </div>
                      <div className="flex items-center justify-between mt-2 bg-gray-50 py-2 pb-3 -mx-3 px-3 -mb-3">
                        <div className="flex items-center space-x-4">
                          <div className="flex items-center gap-1">
                            <AtSign className="h-4 w-4 text-black" />
                            <span className="text-base font-medium text-gray-700">{currencySymbol}{item.price.toFixed(2)}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Calculator className="h-4 w-4 text-black" />
                            <span className={cn(
                              "text-lg font-semibold",
                              item.onHold ? "text-gray-500" : item.discountApplied ? "text-blue-600" : "text-blue-600"
                            )}>
                              {currencySymbol}{item.total.toFixed(2)}
                            </span>
                            <div className="flex items-center ml-1">
                              {item.discount && (
                                <div className="p-1" title={`Discount: ${item.discount.display}`}>
                                  <Tag className="h-4 w-4 text-blue-600" />
                                </div>
                              )}
                              {item.isPerKg && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEditItem(item)}
                                  className="p-1 text-blue-600 hover:bg-blue-50"
                                  title="Per KG item - Click to edit weight"
                                >
                                  <Scale className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleToggleHold(item.id)}
                                className={cn(
                                  "p-1",
                                  item.onHold
                                    ? "text-red-600 hover:bg-red-50"
                                    : "text-red-600 hover:bg-red-50"
                                )}
                                title={item.onHold ? "Resume item" : "Hold item"}
                              >
                                {item.onHold ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                              </Button>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center">
                        {item.isPerKg ? (
                          // For per-KG items: Delete → Weight → Scale (gray theme like regular items)
                          <div className="flex items-center bg-gray-100 rounded-full">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveItem(item.id)}
                              className="w-8 h-8 rounded-full p-0 border-2 border-gray-300 bg-white hover:border-gray-500 hover:bg-gray-50"
                              title="Remove item"
                            >
                              <Trash2 className="h-4 w-4 text-black" />
                            </Button>
                            <div className="bg-gray-100 px-2 py-1">
                              <span className="text-sm font-medium text-black">
                                {item.quantity}
                              </span>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditItem(item)}
                              className="w-8 h-8 rounded-full p-0 border-2 border-gray-300 bg-white hover:border-gray-500 hover:bg-gray-50"
                              title="Edit weight"
                            >
                              <Scale className="h-4 w-4 text-black" />
                            </Button>
                          </div>
                        ) : (
                          // For regular items, show normal quantity controls
                          <div className="flex items-center bg-gray-100 rounded-full">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                              className="w-8 h-8 rounded-full p-0 border-2 border-gray-300 bg-white hover:border-gray-500 hover:bg-gray-50"
                              title="Decrease quantity (0 removes item)"
                            >
                              {item.quantity === 1 ? (
                                <Trash2 className="h-4 w-4 text-black" />
                              ) : (
                                <Minus className="h-4 w-4 text-black" />
                              )}
                            </Button>
                            <div className="bg-gray-100 px-2 py-1">
                              <span className="text-sm font-medium text-black">
                                {item.quantity}
                              </span>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                              className="w-8 h-8 rounded-full p-0 border-2 border-gray-300 bg-white hover:border-gray-500 hover:bg-gray-50"
                              title="Increase quantity"
                            >
                              <Plus className="h-4 w-4 text-black" />
                            </Button>
                          </div>
                        )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              ))
            )}
          </div>
        )}
      </div>

      {/* Bottom Panel */}
      <div className="fixed bottom-0 left-0 right-0 bg-white p-4 max-w-md mx-auto">
        {!currentList.isSplitMode ? (
          <div className="flex gap-2">
            <Button
              onClick={handleOpenFillItems}
              variant="outline"
              className="flex-1 border-blue-300 text-blue-600 hover:bg-blue-50 py-3 text-base font-medium"
            >
              Fill Items
            </Button>
            <Button
              onClick={() => setShowSplitPanel(true)}
              className="flex-1 bg-blue-600 text-white hover:bg-blue-700 py-3 text-base font-medium"
            >
              Split List
            </Button>
          </div>
        ) : (
          <Button
            onClick={handleToggleSplitMode}
            variant="outline"
            className="w-full border-gray-300 text-gray-700 hover:bg-gray-50 py-3 text-base font-medium"
          >
            Exit Split Mode
          </Button>
        )}
      </div>

      {/* Split Configuration Panel */}
      {showSplitPanel && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end justify-center z-50 max-w-md mx-auto">
          <div className="bg-white w-full max-w-md rounded-t-lg p-6 max-h-[50vh] overflow-y-auto border-t-2 border-l-2 border-r-2 border-gray-200 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Configure Split</h3>
              <Button
                variant="ghost"
                onClick={() => setShowSplitPanel(false)}
                className="p-2 hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="space-y-4">
              {currentList.items.some(item => !item.isSplittable) && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                  <div className="flex items-center gap-2">
                    <Scale className="h-4 w-4 text-blue-600" />
                    <p className="text-sm text-blue-800">
                      Multi-purchase discount and Per-KG items will be included as whole units in groups (not split).
                    </p>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2 mb-1">
                <div className="w-32">
                  <label className="block text-xs font-semibold text-gray-500">Target Amount ({currencySymbol})</label>
                </div>
                <div className="w-32">
                  <label className="block text-xs font-semibold text-gray-500">Number of Groups</label>
                </div>
                <div className="w-8" />
              </div>
              {groupSpecs.map((spec, index) => (
                <div key={index} className="flex items-center gap-2 mb-2">
                  <div className="w-32">
                    <Input
                      type="number"
                      inputMode="decimal"
                      value={spec.targetAmount}
                      onChange={(e) => {
                        const newSpecs = [...groupSpecs];
                        newSpecs[index] = { ...newSpecs[index], targetAmount: Number(e.target.value) };
                        setGroupSpecs(newSpecs);
                      }}
                      placeholder="25.00"
                      step="0.01"
                      className="w-full px-4 py-2 text-base"
                    />
                  </div>
                  <div className="w-32">
                    <QuantityInput
                      value={spec.count}
                      onChange={(value) => {
                        const newSpecs = [...groupSpecs];
                        newSpecs[index] = { ...newSpecs[index], count: value };
                        setGroupSpecs(newSpecs);
                      }}
                      min={1}
                      className="w-full"
                    />
                  </div>
                  {groupSpecs.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const newSpecs = groupSpecs.filter((_, i) => i !== index);
                        setGroupSpecs(newSpecs);
                      }}
                      className="text-destructive hover:bg-red-50 p-2"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                  {index === groupSpecs.length - 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setGroupSpecs([...groupSpecs, { targetAmount: 25, count: 2 }])}
                      className="text-primary hover:bg-blue-50 p-2"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setShowSplitPanel(false)}
                  className="flex-1 py-3 text-base"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleRunBinPacking}
                  className="flex-1 bg-blue-600 text-white hover:bg-blue-700 py-3 text-base font-medium"
                >
                  Split Items
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fill Items Panel */}
      {showFillItemsPanel && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end justify-center z-50 max-w-md mx-auto">
          <div className="bg-white w-full max-w-md rounded-t-lg p-4 max-h-[80vh] overflow-hidden border-t-2 border-l-2 border-r-2 border-gray-200 shadow-xl flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-900">Fill Items</h3>
              <Button
                variant="ghost"
                onClick={() => setShowFillItemsPanel(false)}
                className="p-2 hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Target Amount Input */}
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">Target Total ({currencySymbol})</label>
              <Input
                type="number"
                inputMode="decimal"
                value={fillTargetAmount}
                onChange={(e) => setFillTargetAmount(Number(e.target.value))}
                placeholder="50.00"
                step="0.01"
                className="w-full px-4 py-2 text-base"
              />
            </div>

            {/* Summary */}
            <div className="bg-gray-50 rounded-lg p-3 mb-3">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">Current list total:</span>
                <span className="font-medium">{currencySymbol}{getCurrentListTotal().toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">Selected items:</span>
                <span className="font-medium text-blue-600">+{currencySymbol}{getFillItemsTotal().toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm font-semibold border-t border-gray-200 pt-1 mt-1">
                <span>New total:</span>
                <span className={cn(
                  (getCurrentListTotal() + getFillItemsTotal()) > fillTargetAmount ? "text-red-600" : "text-green-600"
                )}>
                  {currencySymbol}{(getCurrentListTotal() + getFillItemsTotal()).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>Gap to target:</span>
                <span>{currencySymbol}{Math.max(0, fillTargetAmount - getCurrentListTotal() - getFillItemsTotal()).toFixed(2)}</span>
              </div>
            </div>

            {/* Suggested Items */}
            {getSuggestedFillItems().length > 0 && (
              <div className="mb-2">
                <p className="text-xs font-medium text-gray-500 mb-1">Suggested to fill gap:</p>
                <div className="flex flex-wrap gap-1">
                  {getSuggestedFillItems().map((item, index) => {
                    const originalIndex = fillSelectedItems.findIndex(i => i.name === item.name);
                    return (
                      <button
                        key={item.name}
                        onClick={() => handleFillItemToggle(originalIndex)}
                        className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full hover:bg-blue-100 transition-colors"
                      >
                        {item.name} ({currencySymbol}{item.price.toFixed(2)})
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Available Items List */}
            <div className="flex-1 overflow-y-auto min-h-0">
              <p className="text-xs font-medium text-gray-500 mb-2">Select items from your history:</p>
              {fillSelectedItems.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p className="text-sm">No items in your history yet.</p>
                  <p className="text-xs mt-1">Add items to your shopping lists to build your history.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {fillSelectedItems.map((item, index) => (
                    <div
                      key={item.name}
                      className={cn(
                        "flex items-center gap-2 p-2 rounded-lg border transition-colors",
                        item.selected ? "bg-blue-50 border-blue-300" : "bg-white border-gray-200"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={item.selected}
                        onChange={() => handleFillItemToggle(index)}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                        <p className="text-xs text-gray-500">{currencySymbol}{item.price.toFixed(2)} each</p>
                      </div>
                      {item.selected && (
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleFillItemQuantityChange(index, item.quantity - 1)}
                            className="w-6 h-6 p-0 rounded-full"
                            disabled={item.quantity <= 1}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="text-sm font-medium w-6 text-center">{item.quantity}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleFillItemQuantityChange(index, item.quantity + 1)}
                            className="w-6 h-6 p-0 rounded-full"
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                      <span className="text-sm font-medium text-gray-700 w-16 text-right">
                        {currencySymbol}{(item.price * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-3 mt-3 border-t border-gray-200">
              <Button
                variant="outline"
                onClick={() => setShowFillItemsPanel(false)}
                className="flex-1 py-3 text-base"
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddFillItems}
                disabled={fillSelectedItems.filter(i => i.selected).length === 0}
                className="flex-1 bg-blue-600 text-white hover:bg-blue-700 py-3 text-base font-medium disabled:opacity-50"
              >
                Add {fillSelectedItems.filter(i => i.selected).length} Item{fillSelectedItems.filter(i => i.selected).length !== 1 ? 's' : ''}
              </Button>
            </div>
          </div>
        </div>
      )}



      {/* Photo Capture Modal */}
      {showPhotoCapture && (
        <PhotoCapture
          key={photoCaptureKey}
          onExtractData={handlePhotoExtractData}
          onClose={() => setShowPhotoCapture(false)}
        />
      )}

      {/* Weight Edit Dialog */}
      {showWeightEditDialog && editingPerKgItem && (
        <WeightEditDialog
          productName={editingPerKgItem.name.replace(/\s*\([0-9.]+kg\)$/, '')}
          pricePerKg={editingPerKgItem.price}
          currentWeight={editingPerKgItem.quantity}
          currentTotal={editingPerKgItem.total}
          onConfirm={handleWeightEditConfirm}
          onCancel={handleWeightEditCancel}
        />
      )}

      {/* Manual Per-KG Dialog */}
      {showManualPerKgDialog && (
        <ManualPerKgDialog
          onConfirm={handleManualPerKgConfirm}
          onCancel={handleManualPerKgCancel}
          suggestions={itemNameSuggestions}
          initialProductName={newItem.name}
          initialPricePerKg={newItem.price}
        />
      )}

      {/* Discard Item Confirmation Dialog */}
      <AlertDialog open={showDiscardItemDialog} onOpenChange={setShowDiscardItemDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard current item?</AlertDialogTitle>
            <AlertDialogDescription>
              You have "{newItem.name}" in the input field. Taking a new photo will replace this item. Do you want to discard it and scan a new item?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowDiscardItemDialog(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowDiscardItemDialog(false);
                setPhotoCaptureKey(prev => prev + 1);
                setShowPhotoCapture(true);
                setNewItem({ name: "", price: 0, quantity: 1, discountApplied: false, onHold: false, isPerKg: false, isSplittable: true, photo: undefined });
              }}
            >
              Discard & Scan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
