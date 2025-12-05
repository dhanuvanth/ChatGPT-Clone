
export enum Role {
  USER = 'user',
  MODEL = 'model'
}

export interface Attachment {
  name: string;
  mimeType: string;
  data: string; // Base64 string
}

export interface Message {
  id: string;
  role: Role;
  text: string;
  attachments?: Attachment[];
  timestamp: number;
  isError?: boolean;
  // For function calling display (optional, could be expanded for rich tool UI)
  toolCalls?: { name: string; args: any }[];
  toolResults?: { name: string; result: any }[];
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

export enum ModelType {
  FLASH = 'gemini-2.5-flash',
  PRO = 'gemini-3-pro-preview'
}

// To mimic RAG, we allow uploading a "Knowledge Base" for the current session
export interface KnowledgeContext {
  files: Attachment[];
}

// MCP Types
export interface MCPTool {
  name: string;
  description?: string;
  inputSchema: any; // JSON Schema
}

export interface MCPServer {
  id: string;
  url: string;
  name: string;
  status: 'connected' | 'error' | 'disconnected';
  tools: MCPTool[];
}

export interface JSONRPCRequest {
  jsonrpc: "2.0";
  method: string;
  params?: any;
  id: number | string;
}

export interface JSONRPCResponse {
  jsonrpc: "2.0";
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
  id: number | string;
}
