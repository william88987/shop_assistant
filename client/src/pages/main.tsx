import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { ShoppingList } from "@shared/schema";
import { storageService } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Edit2, Trash2, ShoppingBag, Settings, DollarSign, Image, ImageOff, Images, Sparkles, History, Download, Upload, ListChecks } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { EditAutocompleteDialog } from "@/components/edit-autocomplete-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { exportShoppingLists, importShoppingLists } from "@/lib/export-import-service";

export default function MainPage() {
  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [showCurrencyDialog, setShowCurrencyDialog] = useState(false);
  const [currencySymbol, setCurrencySymbol] = useState("€");
  const [newCurrencySymbol, setNewCurrencySymbol] = useState("€");
  const [currentPage, setCurrentPage] = useState(1);
  const [extractProductPhotos, setExtractProductPhotos] = useState(true);
  const [showClearPhotosDialog, setShowClearPhotosDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [showEditAutocompleteDialog, setShowEditAutocompleteDialog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const LISTS_PER_PAGE = 10;

  useEffect(() => {
    const savedLists = storageService.getAllLists();
    // Sort lists by date (latest first)
    const sortedLists = savedLists.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setLists(sortedLists);

    // Load currency symbol from localStorage
    const savedCurrency = localStorage.getItem('currencySymbol') || '€';
    setCurrencySymbol(savedCurrency);
    setNewCurrencySymbol(savedCurrency);

    // Load product photo extraction setting
    const savedPhotoSetting = localStorage.getItem('extractProductPhotos');
    setExtractProductPhotos(savedPhotoSetting !== 'false'); // Default to true
  }, []);

  // Cleanup effect to ensure dialog state is properly managed
  useEffect(() => {
    return () => {
      setShowCurrencyDialog(false);
    };
  }, []);

  // Handle escape key to close dialog
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && showCurrencyDialog) {
        handleCancelCurrency();
      }
    };

    if (showCurrencyDialog) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [showCurrencyDialog]);

  const handleDeleteList = (listId: string) => {
    storageService.deleteList(listId);
    const updatedLists = storageService.getAllLists();
    // Sort lists by date (latest first)
    const sortedLists = updatedLists.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setLists(sortedLists);

    // Reset to first page if current page would be empty
    const totalPages = Math.ceil(sortedLists.length / LISTS_PER_PAGE);
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    } else if (sortedLists.length === 0) {
      setCurrentPage(1);
    }
  };

  const handleShowSplashScreen = () => {
    const SPLASH_VERSION = 'v2.4'; // Keep in sync with App.tsx
    localStorage.removeItem(`splashScreenShown_${SPLASH_VERSION}`);
    window.location.reload();
  };



  const handleChangeCurrency = () => {
    localStorage.setItem('currencySymbol', newCurrencySymbol);
    setCurrencySymbol(newCurrencySymbol);
    setShowCurrencyDialog(false);

    toast({
      title: "Currency updated",
      description: `Currency symbol changed to ${newCurrencySymbol}`,
      variant: "default"
    });
  };

  const handleCancelCurrency = () => {
    setNewCurrencySymbol(currencySymbol); // Reset to current value
    setShowCurrencyDialog(false);
  };

  const handleToggleProductPhotos = () => {
    const newValue = !extractProductPhotos;
    setExtractProductPhotos(newValue);
    localStorage.setItem('extractProductPhotos', String(newValue));

    toast({
      title: newValue ? "Product photos enabled" : "Product photos disabled",
      description: newValue
        ? "Photos will be extracted from captured images"
        : "Photo extraction skipped for faster processing",
      variant: "default"
    });
  };

  const handleConfirmClearPhotos = () => {
    // Get all lists from storage
    const allLists = storageService.getAllLists();
    let totalPhotosCleared = 0;

    // Remove photo field from all items in all lists
    const updatedLists = allLists.map(list => {
      const updatedItems = list.items.map(item => {
        if (item.photo) {
          totalPhotosCleared++;
          const { photo, ...itemWithoutPhoto } = item;
          return itemWithoutPhoto;
        }
        return item;
      });

      // Also clear photos from groups if they exist
      const updatedGroups = list.groups?.map(group => ({
        ...group,
        items: group.items.map(item => {
          if (item.photo) {
            const { photo, ...itemWithoutPhoto } = item;
            return itemWithoutPhoto;
          }
          return item;
        })
      }));

      return {
        ...list,
        items: updatedItems,
        groups: updatedGroups
      };
    });

    // Save all updated lists back to storage
    updatedLists.forEach(list => {
      storageService.saveList(list);
    });

    // Refresh the lists display
    const refreshedLists = storageService.getAllLists();
    const sortedLists = refreshedLists.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setLists(sortedLists);

    setShowClearPhotosDialog(false);

    toast({
      title: "Product photos cleared",
      description: `Removed ${totalPhotosCleared} product thumbnail${totalPhotosCleared !== 1 ? 's' : ''} from storage`,
      variant: "default"
    });
  };

  const handleClearAIHistory = () => {
    localStorage.removeItem('ai_saved_responses');
    toast({
      title: "AI history cleared",
      description: "All saved AI responses have been removed",
      variant: "default"
    });
  };

  const handleExport = async () => {
    try {
      await exportShoppingLists();
      toast({
        title: "Export successful",
        description: "Shopping lists exported to zip file",
        variant: "default"
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive"
      });
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setImportFile(file);
      setShowImportDialog(true);
    }
    // Reset input so same file can be selected again
    event.target.value = '';
  };

  const handleImport = async (mergeMode: boolean) => {
    if (!importFile) return;

    try {
      const result = await importShoppingLists(importFile, mergeMode);

      if (result.success) {
        // Refresh lists
        const savedLists = storageService.getAllLists();
        const sortedLists = savedLists.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setLists(sortedLists);

        toast({
          title: "Import successful",
          description: `Imported ${result.listsImported} list${result.listsImported !== 1 ? 's' : ''} with ${result.photosRestored} photo${result.photosRestored !== 1 ? 's' : ''}`,
          variant: "default"
        });
      } else {
        toast({
          title: "Import failed",
          description: result.error || "Unknown error occurred",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Import failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive"
      });
    }

    setShowImportDialog(false);
    setImportFile(null);
  };

  return (
    <div className="max-w-md mx-auto bg-white min-h-screen">
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 pt-2">
          <div className="flex items-center">
            {/* Logo */}
            <Button
              variant="ghost"
              onClick={handleShowSplashScreen}
              className="mr-3 p-0 hover:bg-gray-100 rounded-lg"
              title="Show app info"
            >
              <div className="w-12 h-12 flex items-center justify-center">
                <img
                  src="/logo_new.png"
                  alt="ShopAssist Logo"
                  className="w-12 h-12 object-contain"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    const fallback = target.nextElementSibling as HTMLElement;
                    if (fallback) fallback.style.display = 'block';
                  }}
                />
                {/* Fallback SVG */}
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  className="w-9 h-9 text-white"
                  strokeWidth={1.5}
                  style={{ display: 'none' }}
                >
                  <path d="M3 8h18" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M4 8v8a2 2 0 002 2h12a2 2 0 002-2V8" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M6 12h12" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M6 15h12" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="7" cy="18" r="1.5" />
                  <circle cx="17" cy="18" r="1.5" />
                </svg>
              </div>
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Shopping Lists</h1>
              <p className="text-sm text-gray-600">Manage your shopping efficiently</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {/* AI Assistant Button */}
            <Link href="/ask-ai">
              <Button
                variant="outline"
                size="sm"
                className="px-3 py-2 border-2 border-blue-500 hover:bg-gradient-to-r hover:from-purple-50 hover:to-blue-50 rounded-full flex items-center gap-1.5"
                title="Ask AI Assistant"
              >
                <span className="text-sm font-semibold text-blue-600">Ask AI</span>
                <Sparkles className="h-4 w-4 text-blue-600" />
              </Button>
            </Link>

            {/* Configuration Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="p-2 hover:bg-gray-100"
                  title="Settings"
                >
                  <Settings className="h-5 w-5 text-gray-600" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Configuration</DropdownMenuLabel>
                <DropdownMenuSeparator />

                <DropdownMenuItem onClick={() => setShowCurrencyDialog(true)}>
                  <DollarSign className="mr-2 h-4 w-4" />
                  Change Currency ({currencySymbol})
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleToggleProductPhotos}>
                  {extractProductPhotos ? (
                    <Image className="mr-2 h-4 w-4" />
                  ) : (
                    <ImageOff className="mr-2 h-4 w-4" />
                  )}
                  {extractProductPhotos ? "Disable" : "Enable"} Product Photos
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowClearPhotosDialog(true)}>
                  <Images className="mr-2 h-4 w-4" />
                  Clear All Product Photos
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleClearAIHistory}>
                  <History className="mr-2 h-4 w-4" />
                  Clear AI History
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Item Management</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => setShowEditAutocompleteDialog(true)}>
                  <ListChecks className="mr-2 h-4 w-4" />
                  Edit Autocomplete Items
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Data Management</DropdownMenuLabel>
                <DropdownMenuItem onClick={handleExport}>
                  <Download className="mr-2 h-4 w-4" />
                  Export Shopping Lists
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleImportClick}>
                  <Upload className="mr-2 h-4 w-4" />
                  Import Shopping Lists
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Create New List Button */}
        <Link href="/create">
          <Button className="w-full bg-primary text-white rounded-lg p-4 mb-6 flex items-center justify-center space-x-2 shadow-lg hover:bg-blue-800 transition-colors">
            <Plus className="h-4 w-4" />
            <span className="font-medium">Create New Shopping List</span>
          </Button>
        </Link>

        {/* Previous Lists */}
        <div className="space-y-3">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">Recent Lists</h2>
            {lists.length > 0 && (
              <p className="text-sm text-gray-500">
                {lists.length} list{lists.length !== 1 ? 's' : ''} total
              </p>
            )}
          </div>

          {lists.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <ShoppingBag className="h-16 w-16 mx-auto mb-3 text-gray-300" />
              <p>No previous shopping lists</p>
              <p className="text-sm">Create your first list to get started</p>
            </div>
          ) : (
            <>
              {/* Paginated Lists */}
              {lists
                .slice((currentPage - 1) * LISTS_PER_PAGE, currentPage * LISTS_PER_PAGE)
                .map((list) => (
                  <Card key={list.id} className="bg-white border border-gray-200 shadow-sm">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h3 className="font-medium text-gray-900">{list.name}</h3>
                          <div className="flex items-center space-x-4 mt-1">
                            <p className="text-sm text-gray-600">{new Date(list.date).toLocaleDateString()}</p>
                            <p className="text-sm font-medium text-primary">{currencySymbol}{list.total.toFixed(2)}</p>
                            <p className="text-xs text-gray-500">{list.items.length} items</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Link href={`/list/${list.id}`}>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-primary hover:bg-blue-50 p-2"
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                          </Link>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-primary hover:bg-blue-50 p-2"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Shopping List</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete "{list.name}"? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteList(list.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}

              {/* Pagination Controls */}
              {lists.length > LISTS_PER_PAGE && (
                <div className="flex items-center justify-end pt-4">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-2 text-primary border-primary hover:bg-blue-50 disabled:text-gray-400 disabled:border-gray-300"
                    >
                      &lt;
                    </Button>
                    <div className="flex items-center px-3 py-2 text-sm font-medium text-primary">
                      {currentPage}/{Math.ceil(lists.length / LISTS_PER_PAGE)}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.min(Math.ceil(lists.length / LISTS_PER_PAGE), prev + 1))}
                      disabled={currentPage === Math.ceil(lists.length / LISTS_PER_PAGE)}
                      className="px-3 py-2 text-primary border-primary hover:bg-blue-50 disabled:text-gray-400 disabled:border-gray-300"
                    >
                      &gt;
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Currency Change Dialog */}
      {showCurrencyDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50"
            onClick={handleCancelCurrency}
          />

          {/* Modal Content */}
          <div className="relative bg-white rounded-lg shadow-lg p-6 w-full max-w-md mx-4">
            <div className="mb-4">
              <h2 className="text-lg font-semibold">Change Currency Symbol</h2>
              <p className="text-sm text-gray-600 mt-1">
                Select a common currency or enter a custom symbol.
              </p>
            </div>

            {/* Common Currency Options */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-3">
                Common Currencies
              </label>
              <div className="grid grid-cols-4 gap-2">
                {['$', '€', '£', '¥'].map((symbol) => (
                  <Button
                    key={symbol}
                    variant={newCurrencySymbol === symbol ? "default" : "outline"}
                    onClick={() => setNewCurrencySymbol(symbol)}
                    className="h-12 text-lg font-medium"
                  >
                    {symbol}
                  </Button>
                ))}
              </div>
            </div>

            {/* Manual Input */}
            <div className="mb-6">
              <label htmlFor="currency" className="block text-sm font-medium mb-2">
                Custom Symbol
              </label>
              <Input
                id="currency"
                value={newCurrencySymbol}
                onChange={(e) => setNewCurrencySymbol(e.target.value)}
                placeholder="Enter custom symbol..."
                maxLength={3}
                className="w-full"
              />
            </div>

            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={handleCancelCurrency}>
                Cancel
              </Button>
              <Button onClick={handleChangeCurrency} disabled={!newCurrencySymbol.trim()}>
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Clear Product Photos Confirmation Dialog */}
      {showClearPhotosDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setShowClearPhotosDialog(false)}
          />

          {/* Modal Content */}
          <div className="relative bg-white rounded-lg shadow-lg p-6 w-full max-w-md mx-4">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Clear All Product Photos</h2>
              <p className="text-sm text-gray-600 mt-2">
                This will remove all product thumbnail images from your shopping lists.
                The items and their details will remain, but photos will be deleted.
              </p>
              <p className="text-sm text-gray-600 mt-2">
                This action cannot be undone.
              </p>
            </div>

            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => setShowClearPhotosDialog(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmClearPhotos}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Clear All Photos
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden file input for import */}
      <input
        type="file"
        ref={fileInputRef}
        accept=".zip"
        onChange={handleFileSelected}
        className="hidden"
      />

      {/* Import Confirmation Dialog */}
      {showImportDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => {
              setShowImportDialog(false);
              setImportFile(null);
            }}
          />

          {/* Modal Content */}
          <div className="relative bg-white rounded-lg shadow-lg p-6 w-full max-w-md mx-4">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Import Shopping Lists</h2>
              <p className="text-sm text-gray-600 mt-2">
                You are about to import: <span className="font-medium">{importFile?.name}</span>
              </p>
              <p className="text-sm text-gray-600 mt-2">
                Choose how to handle existing data:
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <Button
                onClick={() => handleImport(true)}
                className="w-full"
              >
                Merge with Existing
              </Button>
              <Button
                onClick={() => handleImport(false)}
                variant="outline"
                className="w-full border-destructive text-destructive hover:bg-destructive/10"
              >
                Replace All Data
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setShowImportDialog(false);
                  setImportFile(null);
                }}
                className="w-full"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
      {/* Edit Autocomplete Dialog */}
      <EditAutocompleteDialog
        open={showEditAutocompleteDialog}
        onClose={() => setShowEditAutocompleteDialog(false)}
        currencySymbol={currencySymbol}
      />
    </div>
  );
}
