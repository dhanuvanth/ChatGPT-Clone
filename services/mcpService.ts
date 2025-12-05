
import { MCPTool, JSONRPCResponse } from "../types";

/**
 * A lightweight MCP Client that assumes the server accepts JSON-RPC 2.0 over HTTP POST.
 * This is a common pattern for web-accessible MCP servers (or bridges).
 */

export const connectToServer = async (url: string): Promise<MCPTool[]> => {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "tools/list",
        id: 1
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data: JSONRPCResponse = await response.json();
    
    if (data.error) {
      throw new Error(data.error.message);
    }

    // MCP spec returns { tools: [...] } inside result
    return data.result.tools || [];
  } catch (error) {
    console.error(`Failed to connect to MCP server at ${url}`, error);
    throw error;
  }
};

export const executeToolCall = async (url: string, toolName: string, args: any): Promise<any> => {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "tools/call",
        params: {
          name: toolName,
          arguments: args
        },
        id: Date.now()
      })
    });

    if (!response.ok) {
        // Fallback: try to return text if it failed
        return { error: `HTTP ${response.status} Error` };
    }

    const data: JSONRPCResponse = await response.json();

    if (data.error) {
      return { error: data.error.message };
    }

    // MCP spec for tools/call returns { content: [{ type: "text", text: "..." }] } usually
    // We will return the raw result to let Gemini parse it, or simplify it.
    return data.result;

  } catch (error: any) {
    return { error: error.message || "Unknown error executing tool" };
  }
};
