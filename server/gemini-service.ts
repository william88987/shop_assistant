import { ExtractionConfig } from './config';
import { LoggingService, APICallLog, AskAILog } from './logging-service';

export interface GeminiExtractionResult {
  success: boolean;
  productName: string;
  price: number;
  confidence: number;
  error?: string;
  rawResponse?: any;
  discount?: {
    type: "bulk_price" | "buy_x_get_y";
    quantity: number;
    value: number;
    display: string;
  };
  isPerKg?: boolean;
  productImage?: string; // Base64 thumbnail of the actual product from the image
  cropArea?: {
    centerX: number; // Center X as percentage (0-100)
    centerY: number; // Center Y as percentage (0-100)
    size: number; // Size as percentage (20-50)
  };
}

export class GeminiService {
  private config: ExtractionConfig;
  private baseUrl = 'https://generativelanguage.googleapis.com/v1/models';
  private loggingService: LoggingService;

  constructor(config: ExtractionConfig) {
    this.config = config;
    this.loggingService = new LoggingService();
  }

  // No separate API call needed - we just return the image data for client-side thumbnail creation
  private async createProductThumbnail(imageData: string): Promise<string | undefined> {
    // Simply return the image data - the client will create the thumbnail
    // No additional Gemini API call needed!
    console.log('📸 Using captured image for thumbnail (no additional API call)');
    return imageData;
  }

  async extractProductInfo(imageData: string, extractPhoto: boolean = true): Promise<GeminiExtractionResult> {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();

    try {
      console.log('🔄 Using Gemini API for extraction...');
      console.log(`📸 Photo extraction: ${extractPhoto ? 'enabled' : 'disabled (faster processing)'}`);

      if (!this.config.geminiApiKey) {
        throw new Error('Gemini API key not configured');
      }

      // Image is already optimized on client side, use as-is
      // Prepare the image data (remove data URL prefix if present)
      const base64Image = imageData.includes(',') ? imageData.split(',')[1] : imageData;

      // Get image dimensions to provide to Gemini
      const imageBuffer = Buffer.from(base64Image, 'base64');
      let imageDimensions = '512x512'; // default assumption
      try {
        const dimStart = Date.now();
        const sharp = (await import('sharp')).default;
        const metadata = await sharp(imageBuffer).metadata();
        if (metadata.width && metadata.height) {
          imageDimensions = `${metadata.width}x${metadata.height}`;
          console.log(`📐 Image dimensions: ${imageDimensions} (extracted in ${Date.now() - dimStart}ms)`);
        }
      } catch (error) {
        console.warn('Could not extract image dimensions, using default');
      }

      const requestBody = {
        contents: [{
          parts: [
            {
              text: `Extract product info from this image as a SINGLE JSON object. If multiple products visible, pick the most prominent one.

productName: Clean name + weight (e.g. "Greek Yogurt 450g"). If no text, identify visually.
price: Current unit price. Use "NOW"/"ONLY" price, NOT "WAS" price. IGNORE "SAVE €X" and "WAS €X". Convert "40c"→0.40. 0 if none.
isPerKg: true only if "PER KG" without weight/total.
discount: Check yellow labels/packaging for multi-buy offers.
  - bulk_price: "X for €Y" where Y is a PRICE. Example: "3 for €6" → {"type":"bulk_price","quantity":3,"value":6.0,"display":"(3 for €6.00)"}
  - buy_x_get_y: "X for Y" where Y < X (pay for fewer). Example: "3 for 2" → {"type":"buy_x_get_y","quantity":3,"value":2,"display":"(3 for 2)"}
  - IMPORTANT: If value has € or is a price amount, use bulk_price. Only use buy_x_get_y when value < quantity.
  - Extract BOTH unit price AND discount.
confidence: 0.8-1.0 (text), 0.4-0.6 (visual).
cropArea: Pick ONE prominent item (not shelf). Ignore labels. Return center % and size %.
  - centerX: horizontal center (0-100%)
  - centerY: vertical center (0-100%)
  - size: 20-50% (typically 35-40 for one item)

IMPORTANT: Return a SINGLE object, NOT an array. If multiple items, choose the most prominent/centered one.

Example: {"productName":"Baby Carrot 200g","price":1.79,"confidence":0.9,"discount":{"type":"bulk_price","quantity":2,"value":3.0,"display":"(2 for €3.00)"},"isPerKg":false,"cropArea":{"centerX":50,"centerY":30,"size":40}}`
            },
            {
              inline_data: {
                mime_type: "image/jpeg",
                data: base64Image
              }
            }
          ]
        }],
        generationConfig: {
          temperature: 0.1,
          topK: 1,
          topP: 0.8,
          maxOutputTokens: 200,
        }
      };

      const url = `${this.baseUrl}/${this.config.geminiModel}:generateContent?key=${this.config.geminiApiKey}`;

      // Retry logic with exponential backoff for rate limiting
      const maxRetries = 3;
      const baseDelay = 1000; // 1 second
      let lastError: Error | null = null;
      let result: any = null;

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          if (attempt > 0) {
            const delay = baseDelay * Math.pow(2, attempt - 1); // 1s, 2s, 4s
            console.log(`⏳ Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms delay...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }

          const fetchStart = Date.now();
          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
          });
          console.log(`📡 Gemini API fetch completed in ${Date.now() - fetchStart}ms`);

          if (response.status === 429) {
            const errorText = await response.text();
            console.warn(`⚠️ Rate limited (429), attempt ${attempt + 1}/${maxRetries}`);
            lastError = new Error(`Rate limited: ${errorText}`);
            continue; // Retry
          }

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Gemini API error: ${response.status} ${response.statusText} - ${errorText}`);
          }

          result = await response.json();
          break; // Success, exit retry loop
        } catch (fetchError) {
          lastError = fetchError instanceof Error ? fetchError : new Error(String(fetchError));
          if (attempt < maxRetries - 1) {
            console.warn(`⚠️ Fetch error, will retry: ${lastError.message}`);
            continue;
          }
        }
      }

      if (!result) {
        throw lastError || new Error('Failed to get response from Gemini API after retries');
      }
      console.log('Gemini API response:', JSON.stringify(result, null, 2));

      // Extract the response text
      const responseText = result.candidates?.[0]?.content?.parts?.[0]?.text;

      console.log('📝 Raw Gemini response text:', responseText);

      if (!responseText) {
        throw new Error('No response text from Gemini API');
      }

      // Try to parse JSON from the response (handle both objects and arrays)
      // Remove markdown code blocks if present
      let cleanedText = responseText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

      console.log('🧹 Cleaned text:', cleanedText);

      let parsedData;
      try {
        // Try to parse directly (works for both arrays and objects)
        parsedData = JSON.parse(cleanedText);
        console.log('✅ Successfully parsed JSON');
      } catch (parseError) {
        console.error('❌ Direct parse failed, trying regex extraction...');

        // Fallback: try to extract JSON with regex
        let jsonMatch = cleanedText.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
          // Try to find object - match from first { to last }
          jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
        }

        if (!jsonMatch) {
          console.error('❌ No JSON found in response:', responseText);
          throw new Error('No JSON found in Gemini response');
        }

        console.log('🔍 Extracted JSON with regex:', jsonMatch[0]);

        try {
          parsedData = JSON.parse(jsonMatch[0]);
        } catch (secondParseError) {
          console.error('❌ JSON parse error:', secondParseError);
          console.error('❌ Attempted to parse:', jsonMatch[0]);
          throw new Error('Failed to parse JSON from Gemini response');
        }
      }

      // If Gemini returned an array, take the first item
      if (Array.isArray(parsedData)) {
        console.log(`📦 Gemini returned ${parsedData.length} items, using the first one`);
        if (parsedData.length === 0) {
          throw new Error('Gemini returned empty array');
        }
        parsedData = parsedData[0];
      }

      // Validate the parsed data
      if (typeof parsedData.productName !== 'string' || typeof parsedData.price !== 'number') {
        throw new Error('Invalid data structure in Gemini response');
      }

      const elapsedTime = (Date.now() - startTime) / 1000;

      // Extract token counts from Gemini response
      const inputTokens = result.usageMetadata?.promptTokenCount || 0;
      const outputTokens = result.usageMetadata?.candidatesTokenCount || 0;

      // Log successful extraction
      const logData: APICallLog = {
        timestamp,
        api: 'Gemini',
        elapsedTime,
        productName: parsedData.productName.trim(),
        price: parseFloat(parsedData.price.toFixed(2)),
        inputTokens,
        outputTokens,
        success: true,
        discount: parsedData.discount?.display
      };
      this.loggingService.logAPICall(logData);

      // Save image if extraction completely failed (no product name at all)
      if (!parsedData.productName) {
        this.loggingService.saveFailedExtractionImage(
          imageData,
          'Gemini',
          'No product name extracted'
        );
      } else if (parsedData.price === 0 && parsedData.productName) {
        console.log('🖼️ Image identification successful (product name without price):', parsedData.productName);
      }

      console.log('✅ Gemini extraction successful:', {
        productName: parsedData.productName,
        price: parsedData.price,
        confidence: parsedData.confidence || 0.8,
        isPerKg: parsedData.isPerKg,
        discount: parsedData.discount
      });

      console.log('📋 Full parsed data from Gemini:', parsedData);

      // Create product thumbnail from the actual captured image (only if enabled)
      let productImage: string | undefined;
      if (extractPhoto) {
        console.log('📸 Extracting product photo...');
        productImage = await this.createProductThumbnail(imageData);
      } else {
        console.log('⏭️ Skipping product photo extraction for faster processing');
      }

      const result_response: GeminiExtractionResult = {
        success: true,
        productName: parsedData.productName.trim(),
        price: parseFloat(parsedData.price.toFixed(2)),
        confidence: Math.min(1.0, Math.max(0.0, parsedData.confidence || 0.8)),
        isPerKg: parsedData.isPerKg || false,
        rawResponse: result,
        productImage: productImage,
        cropArea: parsedData.cropArea
      };

      // Add discount information if present
      if (parsedData.discount &&
        parsedData.discount.type &&
        parsedData.discount.quantity &&
        parsedData.discount.value &&
        (parsedData.discount.type === 'bulk_price' || parsedData.discount.type === 'buy_x_get_y')) {

        let discountType = parsedData.discount.type;
        let discountValue = parsedData.discount.value;

        // Validate and fix discount type based on value
        // For buy_x_get_y: value must be < quantity (e.g., "3 for 2" means value=2, quantity=3)
        // For bulk_price: value is a price (e.g., "3 for €6" means value=6.00)
        if (discountType === 'buy_x_get_y' && discountValue >= parsedData.discount.quantity) {
          // This is actually a bulk_price, not buy_x_get_y
          // e.g., "3 for €6" was misclassified as buy_x_get_y with value=6
          console.log(`⚠️ Correcting discount type: value (${discountValue}) >= quantity (${parsedData.discount.quantity}), switching to bulk_price`);
          discountType = 'bulk_price';
        }

        result_response.discount = {
          type: discountType,
          quantity: parsedData.discount.quantity,
          value: discountValue,
          display: parsedData.discount.display || `(${parsedData.discount.quantity} for ${discountType === 'bulk_price' ? '€' + discountValue.toFixed(2) : discountValue})`
        };
        console.log('✅ Discount detected by Gemini:', result_response.discount);
      }

      return result_response;

    } catch (error) {
      const elapsedTime = (Date.now() - startTime) / 1000;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Log failed extraction
      const logData: APICallLog = {
        timestamp,
        api: 'Gemini',
        elapsedTime,
        productName: '',
        price: 0,
        inputTokens: 0,
        outputTokens: 0,
        success: false,
        error: errorMessage
        // No discount field for failed extractions
      };
      this.loggingService.logAPICall(logData);

      // Save failed extraction image
      this.loggingService.saveFailedExtractionImage(imageData, 'Gemini', errorMessage);

      console.error('❌ Gemini extraction failed:', error);
      return {
        success: false,
        productName: '',
        price: 0,
        confidence: 0,
        error: errorMessage,
        rawResponse: null
      };
    }
  }

  async askAI(prompt: string, recentItems: Array<{ name: string; price: number; quantity: number }>, currencySymbol: string = '€', history?: Array<{ role: string; content: string }>): Promise<{ success: boolean; response: string; error?: string }> {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();

    try {
      console.log('🤖 Processing AI query...');
      console.log('📝 Prompt:', prompt);
      console.log('🛒 Recent items:', recentItems.length);
      if (history?.length) {
        console.log('📚 History turns:', history.length);
      }

      if (!this.config.geminiApiKey) {
        throw new Error('Gemini API key not configured');
      }

      // Build context with recent items including prices
      const itemsContext = recentItems.length > 0
        ? `\n\nUser's recent shopping items with prices:\n${recentItems.map((item, i) => `${i + 1}. ${item.name} - ${currencySymbol}${item.price.toFixed(2)} (qty: ${item.quantity})`).join('\n')}`
        : '\n\nNote: User has no recent shopping items.';

      // Format history if present
      let historyContext = '';
      if (history && history.length > 0) {
        historyContext = `\n\nPrevious Conversation:\n${history.map(h => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.content}`).join('\n')}\n`;
      }

      const fullPrompt = `You are a helpful assistant. Answer the user's question based on their recent shopping items.
${itemsContext}${historyContext}

User Question: ${prompt}

Answer only what the user specifically asks for. Do not suggest recipes or meals unless the user explicitly requests them. Focus on the user's actual question and provide relevant information based on their shopping items.

Please provide a helpful, friendly, and practical response. Format your response with:
- Use clear paragraphs separated by blank lines
- Use numbered lists (1. 2. 3.) for step-by-step instructions when appropriate
- Use bullet points (- or •) for tips or lists when appropriate
- Use ** for section headings
- Keep it concise and easy to read
- Be specific and actionable`;

      const requestBody = {
        contents: [{
          parts: [{
            text: fullPrompt
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024,
        }
      };

      const url = `${this.baseUrl}/${this.config.geminiModel}:generateContent?key=${this.config.geminiApiKey}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      const responseText = result.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!responseText) {
        throw new Error('No response text from Gemini API');
      }

      const elapsedTime = (Date.now() - startTime) / 1000;

      // Extract token counts from Gemini response
      const inputTokens = result.usageMetadata?.promptTokenCount || 0;
      const outputTokens = result.usageMetadata?.candidatesTokenCount || 0;

      // Log successful Ask AI call
      const logData: AskAILog = {
        timestamp,
        apiModel: this.config.geminiModel,
        elapsedTime,
        inputTokens,
        outputTokens,
        success: true
      };
      this.loggingService.logAskAICall(logData);

      console.log('✅ AI response generated successfully');

      return {
        success: true,
        response: responseText.trim()
      };

    } catch (error) {
      const elapsedTime = (Date.now() - startTime) / 1000;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Log failed Ask AI call
      const logData: AskAILog = {
        timestamp,
        apiModel: this.config.geminiModel,
        elapsedTime,
        inputTokens: 0,
        outputTokens: 0,
        success: false,
        error: errorMessage
      };
      this.loggingService.logAskAICall(logData);

      console.error('❌ AI query failed:', error);
      return {
        success: false,
        response: '',
        error: errorMessage
      };
    }
  }
} 