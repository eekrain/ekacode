# Code Understanding Methods for AI Agents

## Executive Summary

This document synthesizes advanced code understanding techniques from two production systems:

- **ts-codebase-analyzer**: TypeScript compiler API-based analysis
- **code-graph-rag**: Graph-based code representation with semantic search

**Goal**: Enable AI agents with robust code understanding beyond simple grep/glob patterns through AST analysis, relationship mapping, and semantic embeddings.

---

## 1. Architectural Approaches

### 1.1 TypeScript Compiler API (ts-codebase-analyzer)

**Core Pattern**: Direct use of TypeScript's official compiler APIs

```typescript
// Initialize TypeScript Program once
private program: ts.Program;
private typeChecker: ts.TypeChecker;

private initializeTypescriptProgram(rootDir: string): void {
  const tsConfigPath = path.join(rootDir, "tsconfig.json");
  const configFile = ts.readConfigFile(tsConfigPath, ts.sys.readFile);
  const compilerOptions = ts.parseJsonConfigFileContent(
    configFile.config, ts.sys, rootDir
  );

  this.program = ts.createProgram(
    compilerOptions.fileNames,
    compilerOptions.options
  );
  this.typeChecker = this.program.getTypeChecker();
}
```

**Benefits**:

- 100% accurate type information
- Handles all TypeScript syntax (decorators, generics, conditional types)
- Native JSDoc extraction
- Built-in error recovery

**Trade-offs**:

- Requires tsconfig.json
- Higher memory footprint (Program in memory)
- TypeScript/JavaScript only

### 1.2 Graph-Based RAG (code-graph-rag)

**Core Pattern**: Multi-pass AST parsing → Knowledge Graph → Vector Embeddings

```
Source Files → Tree-sitter Parser → AST Nodes
                                    ↓
                    Graph Construction (4 passes):
                    1. Structure (files, folders, modules)
                    2. Definitions (classes, functions, interfaces)
                    3. Call Resolution (function call relationships)
                    4. Embeddings (semantic vectorization)
                                    ↓
                    Memgraph/Neo4j Database
                    + Vector Store (UniXcoder embeddings)
```

**Benefits**:

- Language-agnostic (Tree-sitter supports 40+ languages)
- Natural language queries via semantic search
- Relationship traversal (CALLS, IMPORTS, INHERITS)
- Scalable to large codebases

**Trade-offs**:

- More complex architecture
- Requires graph database
- Vector embeddings add latency

---

## 2. Core Techniques for TypeScript Implementation

### 2.1 AST Node Type Guards (from ts-codebase-analyzer)

```typescript
// Source: ts-codebase-analyzer/src/services/typescript-code-mapper.service.ts
processClassMembers(
  node: ts.ClassDeclaration,
  sourceFile: ts.SourceFile,
  info: IClassInfo,
  member?: ts.ClassElement,
): void {
  const currentElement = member ?? node;

  // Method declarations
  if (ts.isMethodDeclaration(currentElement) ||
      ts.isFunctionDeclaration(currentElement) ||
      ts.isArrowFunction(currentElement)) {
    this.aggregateFunctions(currentElement, sourceFile, info);
  }

  // Property declarations
  if (ts.isPropertyDeclaration(currentElement)) {
    this.aggregateProperties(currentElement, sourceFile, info);
  }

  // Getters/Setters
  if (ts.isGetAccessor(currentElement)) {
    const getterInfo = this.extractAccessor(currentElement, "get");
    info.functions?.push(getterInfo);
  }
  if (ts.isSetAccessor(currentElement)) {
    const setterInfo = this.extractAccessor(currentElement, "set");
    info.functions?.push(setterInfo);
  }

  // Nested interfaces/enums
  if (ts.isInterfaceDeclaration(currentElement)) {
    this.aggregateInterfaces(currentElement, sourceFile, info);
  }
}
```

### 2.2 Type Information Extraction

```typescript
// Prefer explicit types, fallback to inference
extractPropertyType(node: ts.PropertyDeclaration): string {
  if (node.type) {
    // Explicit type annotation
    return node.type.getText();
  }

  // Fallback: Type inference via TypeChecker
  const inferredType = this.typeChecker?.getTypeAtLocation(node);
  return inferredType
    ? this.typeChecker.typeToString(inferredType)
    : "any";
}
```

### 2.3 JSDoc Extraction

```typescript
// Built-in TypeScript JSDoc parser
getComment(node: ts.Node): string {
  const jsDocTags = ts.getJSDocCommentsAndTags(node);
  return jsDocTags
    .map(tag => tag.comment || "")
    .join("\n");
}
```

### 2.4 Import Dependency Graph

```typescript
buildDependencyGraph(sourceFile: ts.SourceFile): string[] {
  const imports = sourceFile.statements.filter(ts.isImportDeclaration);

  return imports.map(imp => {
    // Use TypeScript Printer for canonical import syntax
    const printer = ts.createPrinter();
    return printer.printNode(
      ts.EmitHint.Unspecified,
      imp,
      sourceFile
    );
  });
}
```

---

## 3. Tree-sitter for Multi-Language Support

**Adapted from code-graph-rag for TypeScript**

### 3.1 Language Specification Pattern

```typescript
interface LanguageSpec {
  language: string;
  fileExtensions: string[];
  functionNodeTypes: string[];
  classNodeTypes: string[];
  moduleNodeTypes: string[];
  callNodeTypes: string[];
  importNodeTypes: string[];
}

const TYPESCRIPT_SPEC: LanguageSpec = {
  language: "typescript",
  fileExtensions: [".ts", ".tsx"],
  functionNodeTypes: [
    "arrow_function",
    "function_declaration",
    "function_expression",
    "method_definition",
  ],
  classNodeTypes: [
    "class_declaration",
    "interface_declaration",
    "enum_declaration",
    "type_alias_declaration",
  ],
  moduleNodeTypes: ["source_file", "ts_module"],
  callNodeTypes: ["call_expression"],
  importNodeTypes: ["import_statement", "import_expression"],
};
```

### 3.2 Tree-sitter Parser Initialization

```typescript
import * as Parser from "tree-sitter";
import * as TypeScript from "tree-sitter-typescript";

class TreeSitterCodeParser {
  private parser: Parser;

  constructor() {
    this.parser = new Parser();
    this.parser.setLanguage(TypeScript);
  }

  parse(sourceCode: string): Parser.SyntaxNode {
    return this.parser.parse(sourceCode).rootNode;
  }

  // Query for specific patterns
  queryFunctions(root: Parser.SyntaxNode): Parser.QueryMatch[] {
    const query = new Query(
      TypeScript,
      `
      (function_declaration
        name: (identifier) @fn.name
        parameters: (formal_parameters) @fn.params
        body: (statement_block) @fn.body)
    `
    );

    const matches = query.matches(root);
    return matches;
  }
}
```

---

## 4. Call Graph Resolution

**From code-graph-rag, adapted for TypeScript**

### 4.1 Qualified Name Building

```typescript
// Build fully qualified names (e.g., "src.utils.stringHelper.capitalize")
buildQualifiedName(node: Parser.SyntaxNode, moduleQN: string): string {
  const parts: string[] = [moduleQN];
  let current = node.parent;

  while (current && current.type !== 'source_file') {
    if (TYPESCRIPT_SPEC.functionNodeTypes.includes(current.type)) {
      const nameNode = current.childForFieldName('name');
      if (nameNode) {
        parts.unshift(nameNode.text);
      }
    } else if (TYPESCRIPT_SPEC.classNodeTypes.includes(current.type)) {
      const nameNode = current.childForFieldName('name');
      if (nameNode) {
        parts.unshift(nameNode.text);
      }
    }
    current = current.parent;
  }

  return parts.join('.');
}
```

### 4.2 Call Resolution with Fallback Chain

```typescript
class CallResolver {
  private functionRegistry: Map<string, FunctionInfo>;
  private importMapping: Map<string, string>;

  resolveCall(
    callName: string,
    moduleQN: string,
    localContext?: LocalContext
  ): FunctionInfo | null {
    // Strategy 1: Direct lookup in same module
    if (this.functionRegistry.has(`${moduleQN}.${callName}`)) {
      return this.functionRegistry.get(`${moduleQN}.${callName}`)!;
    }

    // Strategy 2: Check imports
    const importedPath = this.importMapping.get(callName);
    if (importedPath) {
      return this.functionRegistry.get(`${importedPath}.${callName}`);
    }

    // Strategy 3: Chained calls (obj.method1().method2())
    if (callName.includes(".")) {
      return this.resolveChainedCall(callName, moduleQN, localContext);
    }

    // Strategy 4: Suffix search via trie
    return this.findEndingWith(callName);
  }

  private findEndingWith(suffix: string): FunctionInfo | null {
    for (const [qn, fn] of this.functionRegistry.entries()) {
      if (qn.endsWith(`.${suffix}`)) {
        return fn;
      }
    }
    return null;
  }
}
```

---

## 5. Semantic Search with Embeddings

### 5.1 Code Embedding Generation

```typescript
// Using OpenAI embeddings or local model (e.g., UniXcoder via ONNX)
class CodeEmbedder {
  private model: EmbeddingModel;

  constructor() {
    // Initialize model (lazy load)
    this.model = new EmbeddingModel();
  }

  async embedCode(code: string): Promise<number[]> {
    // Truncate to max length
    const truncated = this.truncateCode(code, 512);

    // Generate embedding
    const embedding = await this.model.embed(truncated);
    return embedding;
  }

  async embedFunction(functionInfo: FunctionInfo): Promise<CodeEmbedding> {
    // Combine signature and docstring for better semantic representation
    const semanticText = [functionInfo.signature, functionInfo.docstring || "", functionInfo.name]
      .filter(Boolean)
      .join("\n");

    const vector = await this.embedCode(semanticText);

    return {
      qualifiedName: functionInfo.qualifiedName,
      vector,
      metadata: {
        name: functionInfo.name,
        parameters: functionInfo.parameters,
        returnType: functionInfo.returnType,
      },
    };
  }
}
```

### 5.2 Semantic Search

```typescript
class SemanticCodeSearch {
  private embeddings: CodeEmbedding[] = [];

  async findSimilarFunctions(
    query: string,
    threshold: number = 0.7,
    limit: number = 10
  ): Promise<FunctionInfo[]> {
    // Embed the query
    const queryVector = await this.embedCode(query);

    // Calculate cosine similarity
    const similarities = this.embeddings.map(embedding => ({
      embedding,
      similarity: this.cosineSimilarity(queryVector, embedding.vector),
    }));

    // Filter by threshold and sort
    return similarities
      .filter(s => s.similarity >= threshold)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit)
      .map(s => this.embeddingToFunctionInfo(s.embedding));
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    return dotProduct / (magnitudeA * magnitudeB);
  }
}
```

---

## 6. Graph-Based Code Representation

### 6.1 Node and Relationship Types

```typescript
// Graph schema for code understanding
type NodeType =
  | "Project"
  | "Package"
  | "File"
  | "Module"
  | "Class"
  | "Function"
  | "Method"
  | "Interface"
  | "Enum"
  | "TypeAlias";

type RelationshipType =
  | "CONTAINS" // File contains Class
  | "DEFINES" // Class defines Method
  | "IMPORTS" // Module imports Module
  | "EXPORTS" // Module exports Function
  | "CALLS" // Function calls Function
  | "INHERITS" // Class inherits Class
  | "IMPLEMENTS" // Class implements Interface
  | "REFERENCES"; // Function references Type;

interface CodeNode {
  id: string;
  type: NodeType;
  name: string;
  qualifiedName: string;
  properties: Record<string, any>;
}

interface CodeRelationship {
  from: string; // Node ID
  to: string; // Node ID
  type: RelationshipType;
}
```

### 6.2 In-Memory Graph Store

```typescript
class CodeGraph {
  private nodes: Map<string, CodeNode> = new Map();
  private relationships: Map<string, CodeRelationship[]> = new Map();
  private adjacencyList: Map<string, Set<string>> = new Map();

  addNode(node: CodeNode): void {
    this.nodes.set(node.id, node);
    this.adjacencyList.set(node.id, new Set());
  }

  addRelationship(rel: CodeRelationship): void {
    if (!this.relationships.has(rel.from)) {
      this.relationships.set(rel.from, []);
    }
    this.relationships.get(rel.from)!.push(rel);
    this.adjacencyList.get(rel.from)?.add(rel.to);
  }

  // Find nodes by type
  findByType(type: NodeType): CodeNode[] {
    return Array.from(this.nodes.values()).filter(n => n.type === type);
  }

  // Find relationships from a node
  getOutgoing(nodeId: string, type?: RelationshipType): CodeRelationship[] {
    const rels = this.relationships.get(nodeId) || [];
    return type ? rels.filter(r => r.type === type) : rels;
  }

  // Traverse call graph
  findCallChain(startNodeId: string, depth: number = 3): string[] {
    const visited = new Set<string>();
    const result: string[] = [];

    const traverse = (nodeId: string, currentDepth: number) => {
      if (currentDepth > depth || visited.has(nodeId)) return;
      visited.add(nodeId);
      result.push(nodeId);

      const calls = this.getOutgoing(nodeId, "CALLS");
      for (const call of calls) {
        traverse(call.to, currentDepth + 1);
      }
    };

    traverse(startNodeId, 0);
    return result;
  }
}
```

---

## 7. Performance Optimizations

### 7.1 LRU Cache for AST Parsing

```typescript
class ASTCache {
  private cache: LRUCache<string, Parser.SyntaxNode>;
  private maxSize: number;

  constructor(maxSize: number = 1000, maxMemoryMB: number = 500) {
    this.maxSize = maxSize;
    this.cache = new LRUCache({
      max: maxSize,
      // Calculate approximate size
      size: (value, key) => {
        return key.length + (value?.text?.length || 0);
      },
      maxSize: maxMemoryMB * 1024 * 1024,
    });
  }

  get(filePath: string): Parser.SyntaxNode | undefined {
    return this.cache.get(filePath);
  }

  set(filePath: string, ast: Parser.SyntaxNode): void {
    this.cache.set(filePath, ast);
  }
}
```

### 7.2 Function Registry Trie

```typescript
// Fast O(1) lookup for function resolution
class FunctionRegistryTrie {
  private root: TrieNode = {};

  insert(qualifiedName: string, metadata: FunctionInfo): void {
    const parts = qualifiedName.split(".");
    let current = this.root;

    for (const part of parts) {
      if (!current[part]) {
        current[part] = {};
      }
      current = current[part] as TrieNode;
    }

    current["__type"] = "function";
    current["__metadata"] = metadata;
  }

  find(qualifiedName: string): FunctionInfo | null {
    const parts = qualifiedName.split(".");
    let current = this.root;

    for (const part of parts) {
      if (!current[part]) return null;
      current = current[part] as TrieNode;
    }

    return current["__metadata"] || null;
  }

  findEndingWith(suffix: string): FunctionInfo[] {
    const results: FunctionInfo[] = [];
    const search = (node: TrieNode, path: string[]) => {
      if (node["__metadata"] && path.join(".").endsWith(`.${suffix}`)) {
        results.push(node["__metadata"]);
      }
      for (const [key, child] of Object.entries(node)) {
        if (!key.startsWith("__")) {
          search(child as TrieNode, [...path, key]);
        }
      }
    };
    search(this.root, []);
    return results;
  }
}

type TrieNode = {
  [key: string]: TrieNode | "function" | FunctionInfo;
};
```

### 7.3 Batch Processing

```typescript
class BatchProcessor {
  private batchSize: number = 100;
  private buffer: any[] = [];

  async process<T>(items: T[], processor: (batch: T[]) => Promise<void>): Promise<void> {
    for (let i = 0; i < items.length; i += this.batchSize) {
      const batch = items.slice(i, i + this.batchSize);
      await processor(batch);
    }
  }

  async flush(): Promise<void> {
    if (this.buffer.length > 0) {
      await this.process(this.buffer, async batch => {
        // Process batch
      });
      this.buffer = [];
    }
  }
}
```

---

## 8. Integrated AI Agent Tool Architecture

### 8.1 MCP Server Structure

```typescript
// server.ts - MCP Server for code understanding
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

class CodeUnderstandingServer {
  private server: Server;
  private tsAnalyzer: TypeScriptAnalyzer;
  private graph: CodeGraph;
  private semanticSearch: SemanticCodeSearch;

  constructor() {
    this.server = new Server(
      { name: "code-understanding", version: "1.0.0" },
      { capabilities: { tools: {} } }
    );

    this.tsAnalyzer = new TypeScriptAnalyzer(process.cwd());
    this.graph = new CodeGraph();
    this.semanticSearch = new SemanticCodeSearch();

    this.registerHandlers();
  }

  registerHandlers(): void {
    this.server.setRequestHandler(CallToolRequestSchema, async request => {
      const { name, arguments: args } = request.params;

      switch (name) {
        case "analyze_file":
          return this.analyzeFile(args.filePath);

        case "find_references":
          return this.findReferences(args.symbolName);

        case "trace_calls":
          return this.traceCalls(args.functionName, args.depth);

        case "semantic_search":
          return this.semanticFindSimilar(args.query, args.limit);

        case "get_callers":
          return this.getCallers(args.functionName);

        case "get_hierarchy":
          return this.getClassHierarchy(args.className);

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    });
  }

  async analyzeFile(filePath: string): Promise<ToolResult> {
    const moduleInfo = await this.tsAnalyzer.analyzeFile(filePath);

    // Add to graph
    for (const cls of moduleInfo.classes || []) {
      this.graph.addNode({
        id: `${filePath}.${cls.name}`,
        type: "Class",
        name: cls.name,
        qualifiedName: cls.name,
        properties: { filePath, ...cls },
      });
    }

    return {
      content: [{ type: "text", text: JSON.stringify(moduleInfo, null, 2) }],
    };
  }

  async traceCalls(functionName: string, depth: number = 3): Promise<ToolResult> {
    const startNode = this.graph.findByType("Function").find(n => n.name === functionName);

    if (!startNode) {
      return {
        content: [{ type: "text", text: `Function not found: ${functionName}` }],
      };
    }

    const callChain = this.graph.findCallChain(startNode.id, depth);

    const results = callChain.map(id => {
      const node = this.graph.nodes.get(id);
      return {
        name: node?.name,
        qualifiedName: node?.qualifiedName,
        file: node?.properties.filePath,
      };
    });

    return {
      content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
    };
  }

  async semanticFindSimilar(query: string, limit: number = 10): Promise<ToolResult> {
    const similar = await this.semanticSearch.findSimilarFunctions(query, 0.7, limit);

    return {
      content: [{ type: "text", text: JSON.stringify(similar, null, 2) }],
    };
  }

  async getCallers(functionName: string): Promise<ToolResult> {
    const targetNode = this.graph.findByType("Function").find(n => n.name === functionName);

    if (!targetNode) {
      return {
        content: [{ type: "text", text: `Function not found: ${functionName}` }],
      };
    }

    // Find all nodes that CALL this function
    const callers = Array.from(this.graph.nodes.values()).filter(node => {
      const calls = this.graph.getOutgoing(node.id, "CALLS");
      return calls.some(c => c.to === targetNode.id);
    });

    return {
      content: [{ type: "text", text: JSON.stringify(callers, null, 2) }],
    };
  }

  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }
}
```

### 8.2 Tool Definitions

```typescript
const TOOLS = [
  {
    name: "analyze_file",
    description: "Analyze a TypeScript/JavaScript file and extract structure",
    inputSchema: {
      type: "object",
      properties: {
        filePath: {
          type: "string",
          description: "Path to the file to analyze",
        },
      },
      required: ["filePath"],
    },
  },
  {
    name: "find_references",
    description: "Find all references to a symbol in the codebase",
    inputSchema: {
      type: "object",
      properties: {
        symbolName: {
          type: "string",
          description: "Name of the symbol to find",
        },
      },
      required: ["symbolName"],
    },
  },
  {
    name: "trace_calls",
    description: "Trace function call chain starting from a function",
    inputSchema: {
      type: "object",
      properties: {
        functionName: { type: "string" },
        depth: { type: "number", default: 3 },
      },
      required: ["functionName"],
    },
  },
  {
    name: "semantic_search",
    description: "Find functions similar to a natural language query",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Natural language description" },
        limit: { type: "number", default: 10 },
      },
      required: ["query"],
    },
  },
  {
    name: "get_callers",
    description: "Find all functions that call the specified function",
    inputSchema: {
      type: "object",
      properties: {
        functionName: { type: "string" },
      },
      required: ["functionName"],
    },
  },
  {
    name: "get_hierarchy",
    description: "Get class inheritance hierarchy",
    inputSchema: {
      type: "object",
      properties: {
        className: { type: "string" },
      },
      required: ["className"],
    },
  },
];
```

---

## 9. Implementation Recommendations

### 9.1 Hybrid Approach

For production AI agents, combine both approaches:

```typescript
class HybridCodeAnalyzer {
  private tsAnalyzer: TypeScriptAnalyzer; // For accurate TS analysis
  private treeSitter: TreeSitterParser; // For other languages
  private graph: CodeGraph; // Relationship tracking
  private embeddings: SemanticCodeSearch; // Natural language queries

  async analyze(filePath: string): Promise<CodeUnderstanding> {
    // Route to appropriate parser
    if (filePath.match(/\.(ts|tsx|js|jsx)$/)) {
      return this.tsAnalyzer.analyze(filePath);
    } else {
      return this.treeSitter.analyze(filePath);
    }
  }

  async indexProject(rootDir: string): Promise<void> {
    const files = await this.getProjectFiles(rootDir);

    for (const file of files) {
      const analysis = await this.analyze(file);
      this.addToGraph(analysis);

      // Generate embeddings for semantic search
      for (const fn of analysis.functions) {
        const embedding = await this.embeddings.embedFunction(fn);
        this.embeddings.add(embedding);
      }
    }
  }
}
```

### 9.2 Dependencies

```json
{
  "dependencies": {
    "typescript": "^5.3.0",
    "tree-sitter": "^0.20.0",
    "tree-sitter-typescript": "^0.20.0",
    "@modelcontextprotocol/sdk": "^0.5.0",
    "neo4j-driver": "^5.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0"
  }
}
```

### 9.3 Performance Targets

| Operation             | Target Latency | Method                  |
| --------------------- | -------------- | ----------------------- |
| Single file analysis  | <50ms          | TypeScript Compiler API |
| Call graph traversal  | <100ms         | In-memory graph         |
| Semantic search       | <200ms         | Vector embeddings       |
| Full project indexing | <5s            | Parallel processing     |

---

## 10. Key Takeaways

1. **AST > Regex**: Always use proper AST parsing (TypeScript API or Tree-sitter)
2. **Type Information**: Leverage TypeChecker for accurate semantic analysis
3. **Graph Relationships**: Track CALLS, IMPORTS, INHERITS for context
4. **Semantic Search**: Vector embeddings enable natural language queries
5. **Performance**: Cache AST nodes, batch operations, use efficient data structures
6. **Error Resilience**: Process files independently, continue on single-file failures
7. **Multi-Language**: Tree-sitter for language-agnostic parsing, TS API for TypeScript

---

## References

- **ts-codebase-analyzer**: `/home/eekrain/CODE/ekacode/ts-codebase-analyzer`
  - TypeScript Compiler API integration
  - Type-aware code extraction
  - JSDoc parsing

- **code-graph-rag**: `/home/eekrain/CODE/ekacode/code-graph-rag`
  - Tree-sitter multi-language parsing
  - Graph-based code representation
  - Semantic embeddings with UniXcoder
  - Call resolution with fallback strategies

- **Mastra Framework**: `.claude/knowledge/research-mastra.md`
  - Agent orchestration patterns
  - MCP server integration
  - vNext workflow engine
