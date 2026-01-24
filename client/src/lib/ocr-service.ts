// Extraction Service with Server-Side Gemini AI and Smart Suggestions

export interface ProductInfo {
  productName: string;
  price: number;
  confidence: number;
  discount?: {
    type: "bulk_price" | "buy_x_get_y";
    quantity: number;
    value: number;
    display: string;
  };
  isPerKg?: boolean;
  productImage?: string;
  cropArea?: {
    centerX: number;
    centerY: number;
    size: number;
  };
}

export interface ProductSuggestion {
  name: string;
  category: string;
  commonPrices: number[];
}



// Common product suggestions for better UX
const PRODUCT_SUGGESTIONS: ProductSuggestion[] = [
  {
    name: "Coca Cola Original",
    category: "Beverages",
    commonPrices: [1.25, 1.50, 1.75, 2.00, 2.25, 2.50, 3.00, 3.50, 4.00, 5.00, 6.00, 7.00, 8.00, 9.00, 10.00, 11.25]
  },
  {
    name: "Coca Cola Zero",
    category: "Beverages",
    commonPrices: [1.25, 1.50, 1.75, 2.00, 2.25, 2.50, 3.00, 3.50, 4.00, 5.00, 6.00, 7.00, 8.00, 9.00, 10.00, 11.25]
  },
  {
    name: "Pepsi Cola",
    category: "Beverages",
    commonPrices: [1.25, 1.50, 1.75, 2.00, 2.25, 2.50, 3.00, 3.50, 4.00, 5.00, 6.00, 7.00, 8.00, 9.00, 10.00, 11.25]
  },
  {
    name: "Sprite",
    category: "Beverages",
    commonPrices: [1.25, 1.50, 1.75, 2.00, 2.25, 2.50, 3.00, 3.50, 4.00, 5.00, 6.00, 7.00, 8.00, 9.00, 10.00, 11.25]
  },
  {
    name: "Fanta",
    category: "Beverages",
    commonPrices: [1.25, 1.50, 1.75, 2.00, 2.25, 2.50, 3.00, 3.50, 4.00, 5.00, 6.00, 7.00, 8.00, 9.00, 10.00, 11.25]
  },
  {
    name: "Milk",
    category: "Dairy",
    commonPrices: [1.50, 1.75, 2.00, 2.25, 2.50, 2.75, 3.00, 3.25, 3.50, 3.75, 4.00, 4.25, 4.50, 4.75, 5.00]
  },
  {
    name: "Bread",
    category: "Bakery",
    commonPrices: [1.00, 1.25, 1.50, 1.75, 2.00, 2.25, 2.50, 2.75, 3.00, 3.25, 3.50, 3.75, 4.00, 4.25, 4.50, 4.75, 5.00]
  },
  {
    name: "Bananas",
    category: "Fruits",
    commonPrices: [1.00, 1.25, 1.50, 1.75, 2.00, 2.25, 2.50, 2.75, 3.00, 3.25, 3.50, 3.75, 4.00, 4.25, 4.50, 4.75, 5.00]
  },
  {
    name: "Apples",
    category: "Fruits",
    commonPrices: [1.50, 1.75, 2.00, 2.25, 2.50, 2.75, 3.00, 3.25, 3.50, 3.75, 4.00, 4.25, 4.50, 4.75, 5.00]
  },
  {
    name: "Chicken Breast",
    category: "Meat",
    commonPrices: [5.00, 5.50, 6.00, 6.50, 7.00, 7.50, 8.00, 8.50, 9.00, 9.50, 10.00, 10.50, 11.00, 11.50, 12.00]
  },
  {
    name: "Ground Beef",
    category: "Meat",
    commonPrices: [4.00, 4.50, 5.00, 5.50, 6.00, 6.50, 7.00, 7.50, 8.00, 8.50, 9.00, 9.50, 10.00, 10.50, 11.00, 11.50, 12.00]
  },
  {
    name: "Rice",
    category: "Grains",
    commonPrices: [1.00, 1.25, 1.50, 1.75, 2.00, 2.25, 2.50, 2.75, 3.00, 3.25, 3.50, 3.75, 4.00, 4.25, 4.50, 4.75, 5.00]
  },
  {
    name: "Pasta",
    category: "Grains",
    commonPrices: [0.75, 1.00, 1.25, 1.50, 1.75, 2.00, 2.25, 2.50, 2.75, 3.00, 3.25, 3.50, 3.75, 4.00, 4.25, 4.50, 4.75, 5.00]
  },
  {
    name: "Tomatoes",
    category: "Vegetables",
    commonPrices: [1.00, 1.25, 1.50, 1.75, 2.00, 2.25, 2.50, 2.75, 3.00, 3.25, 3.50, 3.75, 4.00, 4.25, 4.50, 4.75, 5.00]
  },
  {
    name: "Onions",
    category: "Vegetables",
    commonPrices: [0.75, 1.00, 1.25, 1.50, 1.75, 2.00, 2.25, 2.50, 2.75, 3.00, 3.25, 3.50, 3.75, 4.00, 4.25, 4.50, 4.75, 5.00]
  }
];

// Get product suggestions based on partial input
export const getProductSuggestions = (input: string): ProductSuggestion[] => {
  if (!input.trim()) return PRODUCT_SUGGESTIONS.slice(0, 5); // Return top 5 if no input

  const lowerInput = input.toLowerCase();
  return PRODUCT_SUGGESTIONS
    .filter(product =>
      product.name.toLowerCase().includes(lowerInput) ||
      product.category.toLowerCase().includes(lowerInput)
    )
    .slice(0, 8); // Limit to 8 suggestions
};

// Get price suggestions for a product
export const getPriceSuggestions = (productName: string): number[] => {
  const product = PRODUCT_SUGGESTIONS.find(p =>
    p.name.toLowerCase() === productName.toLowerCase()
  );

  if (product) {
    return product.commonPrices;
  }

  // Return common price ranges if no specific product found
  return [1.00, 1.25, 1.50, 1.75, 2.00, 2.25, 2.50, 2.75, 3.00, 3.25, 3.50, 3.75, 4.00, 4.25, 4.50, 4.75, 5.00, 5.25, 5.50, 5.75, 6.00, 6.25, 6.50, 6.75, 7.00, 7.25, 7.50, 7.75, 8.00, 8.25, 8.50, 8.75, 9.00, 9.25, 9.50, 9.75, 10.00, 11.25];
};

// Detect discount patterns from extracted text
const detectDiscount = (text: string): { type: "bulk_price" | "buy_x_get_y", quantity: number, value: number, display: string } | null => {
  const discountPatterns = [
    // Type 1: bulk_price - "3 for €10", "2 for 5.99", etc.
    /(\d+)\s+for\s+€?\s*(\d+(?:[.,]\d{2})?)/gi,
    // Type 2: buy_x_get_y - "3 for 2", "2 for 1", etc.
    /(\d+)\s+for\s+(\d+)(?!\d*[.,]\d)/gi, // Negative lookahead to avoid matching prices
  ];

  // Unit price indicators that should NOT be treated as discounts
  const unitPriceIndicators = [
    /each/i,
    /per\s*unit/i,
    /per\s*piece/i,
    /per\s*item/i,
    /unit\s*price/i,
    /individual\s*price/i
  ];

  for (const pattern of discountPatterns) {
    const matches = Array.from(text.matchAll(pattern));
    for (const match of matches) {
      const quantity = parseInt(match[1], 10);
      const value = parseFloat(match[2].replace(',', '.'));

      // Check if this is a unit price indicator (not a discount)
      const isUnitPrice = unitPriceIndicators.some(indicator =>
        indicator.test(text) ||
        text.toLowerCase().includes('each') ||
        text.toLowerCase().includes('per unit')
      );

      if (isUnitPrice) {
        console.log('Skipping unit price indicator:', match[0]);
        continue;
      }

      // Determine discount type
      if (match[0].includes('€') || match[2].includes('.') || match[2].includes(',')) {
        // Type 1: bulk_price
        return {
          type: "bulk_price",
          quantity,
          value,
          display: `(${quantity} for €${value.toFixed(2)})`
        };
      } else if (quantity > value) {
        // Type 2: buy_x_get_y (only if getting more than paying for)
        return {
          type: "buy_x_get_y",
          quantity,
          value,
          display: `(${quantity} for ${value})`
        };
      }
    }
  }

  return null;
};

// Enhanced parsing with multiple strategies
const parseProductInfo = (text: string): { productName: string; price: number; discount?: { type: "bulk_price" | "buy_x_get_y", quantity: number, value: number, display: string }; isPerKg?: boolean } => {
  console.log("=== Starting Text Parsing ===");
  console.log("Original text:", text);

  const cleanedText = preprocessText(text);
  console.log("Cleaned text:", cleanedText);

  const lines = cleanedText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  console.log("Lines after splitting:", lines);

  // Detect per-KG pricing
  const isPerKg = /per\s*kg|\/\s*kg|per\s*kilo/i.test(text);
  if (isPerKg) {
    console.log("Per-KG pricing detected");
  }

  // Detect discount information
  const discount = detectDiscount(text);
  if (discount) {
    console.log("Discount detected:", discount);
  }

  // --- Debug: print all lines for NOW price matching ---
  lines.forEach((line, idx) => {
    if (/now/i.test(line)) {
      console.log(`[DEBUG] Line ${idx} contains 'NOW':`, line);
    }
  });

  let productName = "";
  let price = 0;

  // Enhanced price detection patterns
  const pricePatterns = [
    /NOW\s*€\s*(\d+[.,]\d{2})/gi, // NOW €1.49
    /NOW\s*(\d+)[cC]/gi,           // NOW 40c
    /NOW\s*€\s*(\d+)/gi,           // NOW €1
    /ONLY\s*€\s*(\d+[.,]\d{2})/gi,
    /€\s*(\d+[.,]\d{2})/g,
    /(\d+[.,]\d{2})\s*€/g,
    /ONLY\s*(\d+[.,]\d{2})/g,
    /(\d+[.,]\d{2})/g,
    /€\s*(\d+)\s*(\d{2})/g,  // Handle cases like "€ 11 25"
    /NOW\s*(\d+[.,]\d{2})/gi, // NOW 1.49
    /WAS\s*€\s*(\d+[.,]\d{2})/gi, // WAS €1.49
    /WAS\s*(\d+)[cC]/gi,           // WAS 40c
    /WAS\s*€\s*(\d+)/gi,           // WAS €1
    /WAS\s*(\d+[.,]\d{2})/gi, // WAS 1.49
  ];

  let allPriceMatches: Array<{ price: number, line: string, index: number, pattern: string, isNow?: boolean, isWas?: boolean }> = [];

  // Collect all price matches
  lines.forEach((line, index) => {
    console.log(`Processing line ${index}: "${line}"`);
    // Skip lines with non-euro currencies, but allow per-kg pricing
    if (/£|\$/.test(line)) {
      console.log(`Skipping line ${index} due to non-euro currency`);
      return;
    }

    pricePatterns.forEach((pattern, patternIndex) => {
      const matches = Array.from(line.matchAll(pattern));
      if (matches.length > 0) {
        console.log(`Pattern ${patternIndex} matched on line '${line}':`, matches);
      }
      matches.forEach(match => {
        let priceStr;
        let priceValue = 0;
        let isNow = false;
        let isWas = false;

        console.log(`Processing match:`, match);
        // Allow matches with two decimals or cents, and not immediately followed by a slash
        if (match[0] &&
          (/\d+[.,]\d{2}/.test(match[0]) || /\d+[cC]/.test(match[0])) &&
          !/\d+[.,]\d{2}\//.test(match[0])) {
          if (patternIndex === 1 || patternIndex === 11) { // NOW 40c or WAS 40c
            priceValue = parseInt(match[1], 10) / 100;
          } else if (patternIndex === 8) { // "€ 2 99" format
            priceStr = `${match[1]}.${match[2]}`;
            priceValue = parseFloat(priceStr);
          } else {
            priceStr = match[1] && match[1].replace(',', '.');
            priceValue = parseFloat(priceStr);
          }
          if (patternIndex <= 2 || patternIndex === 8 || patternIndex === 9) isNow = /now/i.test(line);
          if (patternIndex >= 10) isWas = /was/i.test(line);
          if (priceValue > 0.01 && priceValue < 1000) {
            console.log(`Adding price match: ${priceValue} from line "${line}"`);
            allPriceMatches.push({
              price: priceValue,
              line: line,
              index: index,
              pattern: patternIndex.toString(),
              isNow,
              isWas
            });
          } else {
            console.log(`Price value ${priceValue} out of range, skipping`);
          }
        } else {
          console.log(`Match "${match[0]}" doesn't meet criteria, skipping`);
        }
      });
    });
    // Manual fallback: if line contains 'NOW' and ends with 'c', extract cents
    if (/NOW\s*\d+[cC]/.test(line)) {
      const centsMatch = line.match(/NOW\s*(\d+)[cC]/i);
      if (centsMatch && centsMatch[1]) {
        const priceValue = parseInt(centsMatch[1], 10) / 100;
        allPriceMatches.push({
          price: priceValue,
          line: line,
          index: index,
          pattern: 'manual-NOW-cents',
          isNow: true,
          isWas: false
        });
        console.log('Manual fallback: extracted NOW cents price', priceValue, 'from line:', line);
      }
    }
  });

  // Debug: print all price matches
  console.log("All price matches found:", allPriceMatches);

  // Price selection logic
  let selectedPrice = 0;
  // 1. Prefer the lowest NOW price (including cents)
  const nowPrices = allPriceMatches.filter(match => match.isNow);
  if (nowPrices.length > 0) {
    // --- Debug: print all NOW price matches ---
    console.log("[DEBUG] All NOW price matches:", nowPrices);
    const minNow = nowPrices.reduce((min, cur) => cur.price < min.price ? cur : min, nowPrices[0]);
    selectedPrice = minNow.price;
    console.log("Selected lowest NOW price:", minNow);
  } else {
    // 2. Fallback to ONLY price
    const onlyPrice = allPriceMatches.find(match =>
      typeof match.pattern === 'string' ? (match.pattern === 'ONLY_EURO' || match.pattern === 'ONLY') : false
    );
    if (onlyPrice) {
      selectedPrice = onlyPrice.price;
      console.log("Selected ONLY price:", onlyPrice);
    } else {
      // 3. Fallback to first price (but skip WAS if NOW exists)
      const firstPrice = allPriceMatches.find(match => !match.isWas);
      if (firstPrice) {
        selectedPrice = firstPrice.price;
        console.log("Selected first price:", firstPrice);
      } else if (allPriceMatches.length > 0) {
        selectedPrice = allPriceMatches[0].price;
        console.log("Selected fallback price:", allPriceMatches[0]);
      }
    }
  }
  price = selectedPrice;

  // --- Most robust extraction: join all non-barcode, non-price, non-symbol, non-empty lines (after skipping offer/discount lines) as product name ---
  const isBarcode = (line: string) => /^\d{8,}$/.test(line.trim());
  const isPriceLine = (line: string) => /\d+[.,]\d{2}/.test(line) || /\d+\s*[cC]/.test(line) || /€\s*\d+[.,]\d{2}/.test(line);
  const isSymbolLine = (line: string) => /^\s*[€$£]\s*$/i.test(line.trim());
  const offerPatterns = [/save/i, /%/, /offer/i, /discount/i];
  // Collect all non-barcode, non-price, non-symbol, non-empty lines
  let candidateLines = lines.filter(
    line =>
      !isBarcode(line) &&
      !isPriceLine(line) &&
      !isSymbolLine(line) &&
      line.trim().length > 0
  );
  console.log('Extracted lines:', lines);
  console.log('Candidate product name lines:', candidateLines);
  // Skip initial offer/discount lines
  let startIdx = 0;
  while (
    startIdx < candidateLines.length &&
    offerPatterns.some(pat => pat.test(candidateLines[startIdx]))
  ) {
    startIdx++;
  }
  const productNameLines = candidateLines.slice(startIdx);
  if (productNameLines.length >= 1) {
    productName = productNameLines.join(' ').replace(/\s+/g, ' ').trim();
    console.log("Product name from all non-barcode, non-price, non-symbol, non-empty lines:", productName);
  } else {
    productName = '';
    console.log("No valid product name found, leaving empty");
  }
  // Price: prefer first price after 'Total Price', else after last product name line
  if (selectedPrice === 0) {
    let priceStartIdx = 0;
    const totalPriceIdx = lines.findIndex(line => /total price/i.test(line));
    if (totalPriceIdx !== -1) {
      priceStartIdx = totalPriceIdx + 1;
    } else if (productNameLines.length > 0) {
      // Find the index of the last line in the product name block
      const lastProductLine = lines.findIndex((line, idx) => productNameLines[productNameLines.length - 1] === line && idx >= 0);
      priceStartIdx = lastProductLine + 1;
    }
    for (let i = priceStartIdx; i < lines.length; i++) {
      const priceMatch = lines[i].match(/€\s*\d+[.,]\d{2}|\d+[.,]\d{2}|\d+\s*[cC]/);
      if (priceMatch) {
        let priceStr = priceMatch[0].replace(/€|\s|c/gi, '').replace(',', '.');
        if (/c$/i.test(priceMatch[0])) {
          selectedPrice = parseInt(priceStr, 10) / 100;
        } else {
          selectedPrice = parseFloat(priceStr);
        }
        break;
      }
    }
  }
  price = selectedPrice;

  // --- UI/UX: If no product name, still return price ---
  if (!productName) {
    console.log("No product name found, but price extracted:", price);
  }

  // Clean product name by removing unwanted terms and patterns
  const cleanProductName = (name: string): string => {
    if (!name) return name;

    let cleaned = name;

    // Remove specific store names (case insensitive)
    cleaned = cleaned.replace(/dunnes\s+stores/gi, '');
    cleaned = cleaned.replace(/simply\s+better/gi, '');
    cleaned = cleaned.replace(/total\s+price/gi, '');

    // Remove special characters like = or |
    cleaned = cleaned.replace(/[=|]/g, '');

    // Remove long numbers (barcodes) - 8+ digits
    cleaned = cleaned.replace(/\b\d{8,}\b/g, '');

    // Clean up extra whitespace
    cleaned = cleaned.replace(/\s+/g, ' ').trim();

    return cleaned;
  };

  // Apply cleaning to the product name
  productName = cleanProductName(productName);

  console.log("=== Final Result ===");
  console.log("Product Name:", productName);
  console.log("Price:", price);
  if (discount) {
    console.log("Discount:", discount);
  }
  if (isPerKg) {
    console.log("Per-KG pricing:", isPerKg);
  }
  console.log("===================");

  const result: { productName: string; price: number; discount?: { type: "bulk_price" | "buy_x_get_y", quantity: number, value: number, display: string }; isPerKg?: boolean } = { productName, price };
  if (discount) {
    result.discount = discount;
  }
  if (isPerKg) {
    result.isPerKg = isPerKg;
  }
  return result;
};

// Text preprocessing
const preprocessText = (text: string): string => {
  return text
    .replace(/€\s*([0-9]+)[.,]\s*([0-9]{2})/g, '€$1.$2')
    .replace(/ONLY\s*€/g, 'ONLY €')
    .replace(/NOW\s*€/g, 'NOW €')
    .replace(/\s*\n\s*/g, '\n') // keep newlines, just trim around them
    .trim();
};

// Process image using server-side extraction
export const processImageForManualEntry = async (imageData: string, extractPhoto: boolean = true): Promise<ProductInfo> => {
  const startTime = Date.now();

  try {
    console.log("🚀 Processing image with server-side extraction...");
    console.log(`📸 Photo extraction: ${extractPhoto ? 'enabled' : 'disabled (faster)'}`);
    console.log(`📏 Image data size: ${Math.round(imageData.length / 1024)}KB`);

    // Call server-side extraction endpoint
    const fetchStart = Date.now();
    const response = await fetch('/api/ocr', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ imageData, extractPhoto })
    });
    console.log(`📡 Server response received in ${Date.now() - fetchStart}ms`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Server error: ${response.status} ${response.statusText}`, errorText);

      // Check for rate limiting
      if (response.status === 429 || errorText.includes('429') || errorText.includes('RESOURCE_EXHAUSTED')) {
        throw new Error('API rate limit exceeded. Please wait a moment and try again.');
      }

      throw new Error(`Extraction request failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    const totalTime = Date.now() - startTime;
    console.log(`⏱️ Total extraction time: ${totalTime}ms`);
    console.log("Server extraction result:", result);

    if (result.success) {
      console.log("✅ Extraction successful:", {
        productName: result.productName,
        price: result.price,
        backend: result.backend,
        fallbackUsed: result.fallbackUsed
      });

      // Log backend information
      if (result.backend) {
        console.log(`🔧 Used backend: ${result.backend}`);
        if (result.fallbackUsed) {
          console.log(`⚠️ Fallback used: ${result.fallbackReason}`);
        }
      }

      // Special handling for image identification (product name found but no price)
      if (result.productName && result.price === 0 && result.confidence > 0.2) {
        console.log("🖼️ Product identified from image without price text:", result.productName);
      }

      const productInfo = {
        productName: result.productName || "",
        price: result.price || 0,
        confidence: result.confidence || 0.5,
        discount: result.discount,
        isPerKg: result.isPerKg,
        productImage: result.productImage,
        cropArea: result.cropArea
      };

      return productInfo;
    } else {
      // Check if error indicates rate limiting
      if (result.error && (result.error.includes('429') || result.error.includes('rate') || result.error.includes('RESOURCE_EXHAUSTED'))) {
        console.warn("⚠️ Rate limit error detected in response");
      }

      console.log("⚠️ No information extracted from image");
      return {
        productName: "",
        price: 0,
        confidence: 0.1
      };
    }

  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`❌ Server extraction error after ${totalTime}ms:`, error);
    console.log("Falling back to manual entry due to extraction failure");
    return {
      productName: "",
      price: 0,
      confidence: 0.1
    };
  }
}; 