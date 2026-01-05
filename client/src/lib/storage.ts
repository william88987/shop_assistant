import { ShoppingList, ShoppingItem } from "@shared/schema";

const STORAGE_KEY = "shopping_lists";
const ITEM_NAMES_KEY = "shopping_item_names";
const ITEM_PRICES_KEY = "shopping_item_prices";

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

  // Item names autocomplete functionality
  saveItemNames(itemNames: string[]): void {
    try {
      // Get existing item names
      const existingNames = this.getItemNames();
      
      // Merge with new names, remove duplicates, and keep only unique names
      const allNames = [...new Set([...existingNames, ...itemNames])];
      
      // Sort alphabetically and limit to 100 most recent names
      const sortedNames = allNames.sort().slice(-100);
      
      localStorage.setItem(ITEM_NAMES_KEY, JSON.stringify(sortedNames));
    } catch (error) {
      console.error("Error saving item names to localStorage:", error);
    }
  }

  getItemNames(): string[] {
    try {
      const data = localStorage.getItem(ITEM_NAMES_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error("Error reading item names from localStorage:", error);
      return [];
    }
  }

  addItemName(itemName: string): void {
    if (!itemName.trim()) return;
    
    const existingNames = this.getItemNames();
    const trimmedName = itemName.trim();
    
    // Only add if it doesn't already exist (case-insensitive)
    if (!existingNames.some(name => name.toLowerCase() === trimmedName.toLowerCase())) {
      this.saveItemNames([trimmedName]);
    }
  }

  // Item prices functionality - stores latest price for each item
  getItemPrices(): Record<string, number> {
    try {
      const data = localStorage.getItem(ITEM_PRICES_KEY);
      return data ? JSON.parse(data) : {};
    } catch (error) {
      console.error("Error reading item prices from localStorage:", error);
      return {};
    }
  }

  saveItemPrice(itemName: string, price: number): void {
    if (!itemName.trim() || price <= 0) return;
    
    try {
      const prices = this.getItemPrices();
      // Store with lowercase key for case-insensitive lookup
      prices[itemName.trim().toLowerCase()] = price;
      
      // Limit to 100 items to prevent storage bloat
      const entries = Object.entries(prices);
      if (entries.length > 100) {
        const limitedPrices = Object.fromEntries(entries.slice(-100));
        localStorage.setItem(ITEM_PRICES_KEY, JSON.stringify(limitedPrices));
      } else {
        localStorage.setItem(ITEM_PRICES_KEY, JSON.stringify(prices));
      }
    } catch (error) {
      console.error("Error saving item price to localStorage:", error);
    }
  }

  getItemPrice(itemName: string): number | undefined {
    const prices = this.getItemPrices();
    return prices[itemName.trim().toLowerCase()];
  }

  // Combined method to add item name and price together
  addItemWithPrice(itemName: string, price: number): void {
    this.addItemName(itemName);
    this.saveItemPrice(itemName, price);
  }

  // Get all items with their prices
  getItemsWithPrices(): ItemWithPrice[] {
    const names = this.getItemNames();
    const prices = this.getItemPrices();
    
    return names.map(name => ({
      name,
      price: prices[name.toLowerCase()] || 0
    }));
  }
}

export const storageService = LocalStorageService.getInstance();
