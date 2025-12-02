import { GoogleGenAI, Content, Part } from "@google/genai";
import { Message, Role, ModelType, Attachment } from "../types";

const createClient = () => {
  if (!process.env.API_KEY) {
    console.error("API_KEY is missing from environment variables");
  }
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export const streamChatResponse = async (
  messages: Message[],
  model: ModelType,
  onChunk: (text: string) => void,
  contextFiles: Attachment[] = []
): Promise<string> => {
  const ai = createClient();

  // Construct the history for the API
  // We need to inject the "Context Files" (RAG simulation) into the beginning of the conversation
  // or attached to the latest message.
  // For better performance with large context, we'll prepend them as a "User" message saying "Here is some context".

  const contents: Content[] = [];

  // 1. Add Context Files (RAG)
  // We treat these as if the user uploaded them at the very start of the session for context.
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
      contextParts.push({
         text: `\n[File: ${file.name}]\n`
      });
    });

    contents.push({
      role: 'user',
      parts: contextParts
    });

    contents.push({
      role: 'model',
      parts: [{ text: "Understood. I have processed the provided documents and will use them as context for our conversation." }]
    });
  }

  // 2. Add History
  // Convert our internal Message type to the API's Content type
  messages.forEach(msg => {
    const parts: Part[] = [];
    
    // Add existing attachments in history
    if (msg.attachments && msg.attachments.length > 0) {
      msg.attachments.forEach(att => {
        parts.push({
          inlineData: {
            mimeType: att.mimeType,
            data: att.data
          }
        });
      });
    }

    if (msg.text) {
      parts.push({ text: msg.text });
    }

    contents.push({
      role: msg.role === Role.USER ? 'user' : 'model',
      parts: parts
    });
  });

  // Note: The last message in `messages` is the one we just sent.
  // The API expects the last message to be 'user' if we are asking for a response.
  // Our React state usually updates *immediately* with the user message, so `messages` includes the latest prompt.
  
  try {
    const responseStream = await ai.models.generateContentStream({
      model: model,
      contents: contents,
      config: {
        // High limit for RAG tasks
        maxOutputTokens: 8192, 
        systemInstruction: "You are a helpful AI assistant modeled after ChatGPT. You are expert at analyzing documents and answering questions based on the provided context. Always format your response in clean Markdown."
      }
    });

    let fullText = "";

    for await (const chunk of responseStream) {
      const text = chunk.text;
      if (text) {
        fullText += text;
        onChunk(fullText);
      }
    }

    return fullText;

  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};
