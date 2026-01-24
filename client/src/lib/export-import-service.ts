import JSZip from 'jszip';
import { ShoppingList } from '@shared/schema';
import { storageService } from './storage';

interface ExportData {
    version: string;
    exportDate: string;
    lists: ShoppingList[];
    photoMapping: Record<string, string>; // itemId -> photo filename
}

/**
 * Exports all shopping lists with photos to a zip file
 */
export async function exportShoppingLists(): Promise<void> {
    const lists = storageService.getAllLists();
    const zip = new JSZip();
    const photoMapping: Record<string, string> = {};
    let photoIndex = 0;

    // Process all lists and extract photos
    const processedLists = lists.map(list => {
        const processedItems = list.items.map(item => {
            if (item.photo) {
                const photoFilename = `photo_${photoIndex++}.jpg`;
                photoMapping[item.id] = photoFilename;

                // Extract base64 data and add to zip
                const base64Data = item.photo.replace(/^data:image\/\w+;base64,/, '');
                zip.file(`photos/${photoFilename}`, base64Data, { base64: true });

                // Return item without photo (we'll reference it via mapping)
                const { photo, ...itemWithoutPhoto } = item;
                return itemWithoutPhoto;
            }
            return item;
        });

        // Process group items if they exist
        const processedGroups = list.groups?.map(group => ({
            ...group,
            items: group.items.map(item => {
                if (item.photo) {
                    const photoFilename = `photo_${photoIndex++}.jpg`;
                    photoMapping[item.id] = photoFilename;

                    const base64Data = item.photo.replace(/^data:image\/\w+;base64,/, '');
                    zip.file(`photos/${photoFilename}`, base64Data, { base64: true });

                    const { photo, ...itemWithoutPhoto } = item;
                    return itemWithoutPhoto;
                }
                return item;
            })
        }));

        return {
            ...list,
            items: processedItems,
            groups: processedGroups
        };
    });

    // Create export data
    const exportData: ExportData = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        lists: processedLists,
        photoMapping
    };

    // Add data.json to zip
    zip.file('data.json', JSON.stringify(exportData, null, 2));

    // Generate zip and trigger download
    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const link = document.createElement('a');
    link.href = url;

    // Create filename with timestamp
    const date = new Date();
    const timestamp = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}_${String(date.getHours()).padStart(2, '0')}${String(date.getMinutes()).padStart(2, '0')}`;
    link.download = `shopping_lists_${timestamp}.zip`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

interface ImportResult {
    success: boolean;
    listsImported: number;
    photosRestored: number;
    error?: string;
}

/**
 * Imports shopping lists from a zip file
 * @param file - The zip file to import
 * @param mergeMode - If true, merges with existing data; if false, replaces all data
 */
export async function importShoppingLists(file: File, mergeMode: boolean = true): Promise<ImportResult> {
    try {
        const zip = await JSZip.loadAsync(file);

        // Read data.json
        const dataFile = zip.file('data.json');
        if (!dataFile) {
            return { success: false, listsImported: 0, photosRestored: 0, error: 'Invalid zip file: data.json not found' };
        }

        const dataContent = await dataFile.async('string');
        const exportData: ExportData = JSON.parse(dataContent);

        // Validate version
        if (!exportData.version || !exportData.lists) {
            return { success: false, listsImported: 0, photosRestored: 0, error: 'Invalid export data format' };
        }

        // Load photos from zip
        const photos: Record<string, string> = {};
        for (const [itemId, filename] of Object.entries(exportData.photoMapping)) {
            const photoFile = zip.file(`photos/${filename}`);
            if (photoFile) {
                const photoData = await photoFile.async('base64');
                photos[itemId] = `data:image/jpeg;base64,${photoData}`;
            }
        }

        let photosRestored = 0;

        // Reconstruct lists with photos
        const restoredLists = exportData.lists.map(list => {
            const restoredItems = list.items.map(item => {
                if (photos[item.id]) {
                    photosRestored++;
                    return { ...item, photo: photos[item.id] };
                }
                return item;
            });

            const restoredGroups = list.groups?.map(group => ({
                ...group,
                items: group.items.map(item => {
                    if (photos[item.id]) {
                        photosRestored++;
                        return { ...item, photo: photos[item.id] };
                    }
                    return item;
                })
            }));

            return {
                ...list,
                items: restoredItems,
                groups: restoredGroups
            };
        });

        // Handle merge vs replace
        if (mergeMode) {
            // Merge: add new lists, update existing ones by ID
            restoredLists.forEach(list => {
                storageService.saveList(list);
            });
        } else {
            // Replace: clear existing and add all imported
            const existingLists = storageService.getAllLists();
            existingLists.forEach(list => {
                storageService.deleteList(list.id);
            });
            restoredLists.forEach(list => {
                storageService.saveList(list);
            });
        }

        return {
            success: true,
            listsImported: restoredLists.length,
            photosRestored
        };
    } catch (error) {
        console.error('Import error:', error);
        return {
            success: false,
            listsImported: 0,
            photosRestored: 0,
            error: error instanceof Error ? error.message : 'Unknown error occurred'
        };
    }
}

/**
 * Gets statistics about current data for export preview
 */
export function getExportStats(): { listCount: number; itemCount: number; photoCount: number } {
    const lists = storageService.getAllLists();
    let itemCount = 0;
    let photoCount = 0;

    lists.forEach(list => {
        itemCount += list.items.length;
        list.items.forEach(item => {
            if (item.photo) photoCount++;
        });

        list.groups?.forEach(group => {
            group.items.forEach(item => {
                if (item.photo) photoCount++;
            });
        });
    });

    return { listCount: lists.length, itemCount, photoCount };
}
