export interface BuilderMaterializationResult {
  status: 'dry-run' | 'written';
  projectId: string;
  destination: string;
  destinationExists: boolean;
  files: Array<{ path: string; targetPath: string; sizeBytes: number }>;
  totalBytes: number;
  policy: {
    dependenciesInstalled: false;
    generatedCodeExecuted: false;
    networkAccess: false;
    deployed: false;
  };
}

export function validateBuilderFilesArtifact(value: unknown): Record<string, unknown>;
export function planBuilderMaterialization(value: unknown, outputDirectory: string): BuilderMaterializationResult;
export function materializeBuilderFiles(
  value: unknown,
  outputDirectory: string,
  options?: { write?: boolean },
): BuilderMaterializationResult;
export function runBuilderMaterializer(args?: string[], stdout?: NodeJS.WritableStream): BuilderMaterializationResult | null;
