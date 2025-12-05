
import { GoogleGenAI, Content, Part, FunctionDeclaration, Tool, FunctionCall } from "@google/genai";
import { Message, Role, ModelType, Attachment, MCPTool, MCPServer } from "../types";
import { executeToolCall } from "./mcpService";

const createClient = () => {
  const customKey = localStorage.getItem('gemini_api_key');
  const apiKey = customKey || process.env.API_KEY;

  if (!apiKey) {
    throw new Error("API Key is missing. Please add it in settings or provide it via environment variables.");
  }
  return new GoogleGenAI({ apiKey });
};

// Convert internal Message format to Gemini Content format
const formatHistory = (messages: Message[], contextFiles: Attachment[]): Content[] => {
  const contents: Content[] = [];

  // 1. RAG Context Injection
  if (contextFiles.length > 0) {
    const contextParts: Part[] = [
      { text: "Here are the documents/context I want you to use for this conversation:" }
    ];

    contextFiles.forEach(file => {
      contextParts.push({
        inlineData: {
          mimeType: file.mimeType,
          data: file.data
        }
      });
      contextParts.push({ text: `\n[File: ${file.name}]\n` });
    });

    contents.push({ role: 'user', parts: contextParts });
    contents.push({ role: 'model', parts: [{ text: "Understood. I have processed the provided documents." }] });
  }

  // 2. Message History
  messages.forEach(msg => {
    const parts: Part[] = [];
    
    // Attachments
    if (msg.attachments && msg.attachments.length > 0) {
      msg.attachments.forEach(att => {
        parts.push({
          inlineData: { mimeType: att.mimeType, data: att.data }
        });
      });
    }

    // Text
    if (msg.text) parts.push({ text: msg.text });

    // Function Calls (Model)
    if (msg.toolCalls && msg.toolCalls.length > 0) {
      msg.toolCalls.forEach(tc => {
        parts.push({
          functionCall: {
             name: tc.name,
             args: tc.args
          }
        });
      });
    }

    // Function Results (User/System)
    if (msg.toolResults && msg.toolResults.length > 0) {
      msg.toolResults.forEach(tr => {
         parts.push({
            functionResponse: {
               name: tr.name,
               response: { result: tr.result }
            }
         });
      });
    }

    // Only add if we have parts (skips empty messages which might happen during optimistic updates)
    if (parts.length > 0) {
      contents.push({
        role: msg.role === Role.USER ? 'user' : 'model',
        parts: parts
      });
    }
  });

  return contents;
};

// Convert MCP Tools to Gemini Tools
const formatTools = (mcpServers: MCPServer[]): Tool[] => {
  const functionDeclarations: FunctionDeclaration[] = [];

  mcpServers.forEach(server => {
    if (server.status === 'connected') {
      server.tools.forEach(tool => {
        functionDeclarations.push({
          name: tool.name,
          description: tool.description || `Tool from ${server.name}`,
          parameters: tool.inputSchema
        });
      });
    }
  });

  if (functionDeclarations.length === 0) return [];
  return [{ functionDeclarations }];
};

export const streamChatResponse = async (
  messages: Message[],
  model: ModelType,
  onChunk: (text: string) => void,
  contextFiles: Attachment[] = [],
  mcpServers: MCPServer[] = []
): Promise<string> => {
  const ai = createClient();
  const tools = formatTools(mcpServers);
  const contents = formatHistory(messages, contextFiles);
  
  // Create a mutable history that we can append to during function calling loops
  let currentContents = [...contents];
  let fullTextResponse = "";

  // Loop for handling function calls (max 5 turns to prevent infinite loops)
  for (let turn = 0; turn < 5; turn++) {
    try {
      const stream = await ai.models.generateContentStream({
        model: model,
        contents: currentContents,
        config: {
          maxOutputTokens: 8192,
          systemInstruction: "You are a helpful AI assistant. Use provided tools when necessary. When using a tool, you don't need to ask for permission.",
          tools: tools.length > 0 ? tools : undefined
        }
      });

      let bufferText = "";
      const toolCallsMap = new Map<string, FunctionCall>();
      let hasToolCalls = false;

      // Iterate through the stream chunks
      for await (const chunk of stream) {
        // 1. Text
        const text = chunk.text;
        if (text) {
          bufferText += text;
          onChunk(bufferText); // Update UI with typing effect
        }

        // 2. Tool Calls
        // We inspect candidates directly from the chunk
        const candidates = chunk.candidates;
        if (candidates && candidates[0]?.content?.parts) {
           for (const part of candidates[0].content.parts) {
              if (part.functionCall) {
                 // Store/Update the function call. 
                 // Assuming the last chunk containing the function call has the complete args.
                 toolCallsMap.set(part.functionCall.name, part.functionCall);
                 hasToolCalls = true;
              }
           }
        }
      }

      fullTextResponse = bufferText;

      // If no tools were called, we are finished with this turn/response
      if (!hasToolCalls) {
        return fullTextResponse;
      }

      // Handle Tool Calls
      const functionCalls = Array.from(toolCallsMap.values());
      
      // We must add the model's output (thought/text + function call) to the history
      // so the model knows what it just did.
      const modelParts: Part[] = [];
      
      if (fullTextResponse) {
          modelParts.push({ text: fullTextResponse });
      }
      
      functionCalls.forEach(fc => {
          modelParts.push({ functionCall: fc });
      });

      // 1. Push Model Turn
      currentContents.push({
         role: 'model',
         parts: modelParts
      });

      // 2. Execute Tools
      const functionResponses: Part[] = [];
      
      for (const call of functionCalls) {
         const toolName = call.name;
         const toolArgs = call.args;

         console.log(`[Gemini] Calling Tool: ${toolName}`, toolArgs);
         
         // Visual feedback in the stream (appended to text)
         onChunk(fullTextResponse + `\n\n*Executing tool: ${toolName}...*\n\n`);

         // Find which server has this tool
         const server = mcpServers.find(s => s.tools.some(t => t.name === toolName));
         
         let result;
         if (server) {
            result = await executeToolCall(server.url, toolName, toolArgs);
         } else {
            result = { error: `Tool ${toolName} not found in connected servers.` };
         }

         functionResponses.push({
            functionResponse: {
               name: toolName,
               response: { result: result }
            }
         });
      }

      // 3. Push User Turn (Function Results)
      currentContents.push({
         role: 'user',
         parts: functionResponses
      });
      
      // The loop will now continue to the next turn, sending the tool outputs back to Gemini
      // so it can generate the final answer.

    } catch (error) {
      console.error("Gemini API Error:", error);
      throw error;
    }
  }

  return fullTextResponse;
};
