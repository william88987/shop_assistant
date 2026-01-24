import { ShoppingList, ShoppingItem } from "@shared/schema";

const STORAGE_KEY = "shopping_lists";

// Type for item with price
export interface ItemWithPrice {
  name: string;
  price: number;
}

export class LocalStorageService {
  private static instance: LocalStorageService;

  public static getInstance(): LocalStorageService {
    if (!LocalStorageService.instance) {
      LocalStorageService.instance = new LocalStorageService();
    }
    return LocalStorageService.instance;
  }

  getAllLists(): ShoppingList[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error("Error reading from localStorage:", error);
      return [];
    }
  }

  saveList(list: ShoppingList): void {
    try {
      const lists = this.getAllLists();
      const existingIndex = lists.findIndex(l => l.id === list.id);

      if (existingIndex >= 0) {
        lists[existingIndex] = list;
      } else {
        lists.push(list);
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(lists));
    } catch (error) {
      console.error("Error saving to localStorage:", error);
    }
  }

  getList(id: string): ShoppingList | null {
    const lists = this.getAllLists();
    return lists.find(l => l.id === id) || null;
  }

  deleteList(id: string): void {
    try {
      const lists = this.getAllLists();
      const filteredLists = lists.filter(l => l.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filteredLists));
    } catch (error) {
      console.error("Error deleting from localStorage:", error);
    }
  }

  updateList(list: ShoppingList): void {
    this.saveList(list);
  }

  // Item names autocomplete functionality - now pulls from shopping list history
  // These methods maintain backwards compatibility but data comes from shopping lists

  getItemNames(): string[] {
    try {
      const lists = this.getAllLists();
      const itemNames = new Set<string>();

      lists.forEach(list => {
        list.items.forEach(item => {
          // Clean the item name (remove weight patterns like "(0.25kg)")
          const cleanedName = item.name
            .replace(/\s*\([0-9.]+kg\)/gi, '')
            .replace(/\s*\([^)]*for[^)]*\)/gi, '') // Remove discount patterns
            .trim();

          if (cleanedName && cleanedName.length > 0) {
            itemNames.add(cleanedName);
          }
        });
      });

      // Sort alphabetically
      return Array.from(itemNames).sort();
    } catch (error) {
      console.error("Error getting item names from shopping lists:", error);
      return [];
    }
  }

  // Get all items with their prices from shopping list history
  getItemsWithPrices(): ItemWithPrice[] {
    try {
      const lists = this.getAllLists();
      const itemsMap = new Map<string, { name: string; price: number }>();

      // Process lists in order (older first) so newer prices overwrite older ones
      lists.forEach(list => {
        list.items.forEach(item => {
          // Clean the item name
          const cleanedName = item.name
            .replace(/\s*\([0-9.]+kg\)/gi, '')
            .replace(/\s*\([^)]*for[^)]*\)/gi, '')
            .trim();

          if (cleanedName && cleanedName.length > 0 && item.price > 0) {
            // Use lowercase key for deduplication, store original case
            const key = cleanedName.toLowerCase();
            itemsMap.set(key, { name: cleanedName, price: item.price });
          }
        });
      });

      // Convert to array and sort by name
      return Array.from(itemsMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      console.error("Error getting items with prices from shopping lists:", error);
      return [];
    }
  }

  // Legacy methods - kept for compatibility but now no-ops since data comes from shopping lists
  saveItemNames(itemNames: string[]): void {
    // No longer needed - autocomplete data comes from shopping lists
  }

  addItemName(itemName: string): void {
    // No longer needed - autocomplete data comes from shopping lists
  }

  getItemPrices(): Record<string, number> {
    // Build from shopping list history
    const itemsWithPrices = this.getItemsWithPrices();
    const prices: Record<string, number> = {};
    itemsWithPrices.forEach(item => {
      prices[item.name.toLowerCase()] = item.price;
    });
    return prices;
  }

  saveItemPrice(itemName: string, price: number): void {
    // No longer needed - prices come from shopping lists
  }

  getItemPrice(itemName: string): number | undefined {
    const prices = this.getItemPrices();
    return prices[itemName.trim().toLowerCase()];
  }

  addItemWithPrice(itemName: string, price: number): void {
    // No longer needed - data comes from shopping lists
  }
}

export const storageService = LocalStorageService.getInstance();
