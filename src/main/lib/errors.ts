export class AppError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AppError";
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Not found") {
    super(message);
    this.name = "NotFoundError";
  }
}

export class BundleNotOpenError extends AppError {
  constructor(message = "No bundle is open") {
    super(message);
    this.name = "BundleNotOpenError";
  }
}

export class PathTraversalError extends AppError {
  constructor(message = "Path escapes the bundle root") {
    super(message);
    this.name = "PathTraversalError";
  }
}

export class UnparseableFrontmatterError extends AppError {
  constructor(message = "Frontmatter is not valid YAML") {
    super(message);
    this.name = "UnparseableFrontmatterError";
  }
}

export class ValidationError extends AppError {
  constructor(message = "Validation failed") {
    super(message);
    this.name = "ValidationError";
  }
}
