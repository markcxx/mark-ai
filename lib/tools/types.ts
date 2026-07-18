export type BuiltinToolStatus = "available" | "planned";
export type BuiltinToolKind = "tool" | "skill";

export type ToolJsonSchema = {
  additionalProperties?: boolean;
  description?: string;
  items?: ToolJsonSchema;
  maxItems?: number;
  maxLength?: number;
  properties?: Record<string, ToolJsonSchema>;
  required?: string[];
  type: "array" | "boolean" | "integer" | "number" | "object" | "string";
};

export type BuiltinToolFunction = {
  description: string;
  name: string;
  parameters: ToolJsonSchema;
};

export type BuiltinToolDefinition = {
  accent: "amber" | "blue" | "emerald" | "violet";
  category: "creation" | "documents";
  description: string;
  features: string[];
  functions: BuiltinToolFunction[];
  id: string;
  kind: BuiltinToolKind;
  name: string;
  shortName: string;
  status: BuiltinToolStatus;
  systemPrompt?: string;
  version: string;
};

export type BuiltinToolCatalogItem = Omit<BuiltinToolDefinition, "systemPrompt"> & {
  installed: boolean;
};

export type ToolExecutionContext = {
  sessionId: string;
  userId: string;
};

export type GeneratedFile = {
  contentType: string;
  id: string;
  name: string;
  size: number;
  url: string;
};

export type ToolExecutionResult = {
  content: Record<string, unknown>;
  file?: GeneratedFile;
};
