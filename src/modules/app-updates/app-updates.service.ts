import { promises as fs } from 'fs';
import { resolve } from 'path';
import type { FastifyBaseLogger } from 'fastify';
import { env } from '../../config/env';
import { AppError, ErrorCodes } from '../../lib/errors';

const DEFAULT_APP_UPDATE_STORAGE_DIR = 'storage/app-updates';
const DEFAULT_APK_MIME_TYPE = 'application/vnd.android.package-archive';
const MAX_RELEASE_HISTORY = 2;

type StoredAppRelease = {
  version: string;
  notes: string;
  fileName: string;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
  publishedAt: string;
};

type AppUpdateManifest = {
  history: StoredAppRelease[];
};

export type AppUpdateRelease = StoredAppRelease & {
  isLatest: boolean;
  fileExists: boolean;
  downloadUrl: string;
  latestDownloadUrl: string;
};

export type AppUpdateStatus = {
  currentVersion: string;
  latestVersion: string;
  isLatest: boolean;
  release: AppUpdateRelease | null;
};

type UploadAppReleaseParams = {
  version: string;
  notes?: string;
  fileName?: string;
  mimeType?: string;
  bytes: Buffer;
};

type AppUpdateDownloadAsset = {
  path: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
};

type DeleteAppReleaseResult = {
  version: string;
  fileName: string;
  fileDeleted: boolean;
  latestVersion: string | null;
};

function trimTrailingSlash(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

function sanitizeFileNameSegment(value: string): string {
  const normalized = value.trim().toLowerCase();
  const collapsed = normalized.replace(/[^a-z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return collapsed || 'release';
}

function pickReleaseFileName(version: string, originalFileName?: string): string {
  const fallback = `ourhangout-android-${sanitizeFileNameSegment(version)}.apk`;
  const trimmedOriginal = (originalFileName || '').trim();
  if (!trimmedOriginal) return fallback;

  const extensionMatch = /\.[A-Za-z0-9]+$/.exec(trimmedOriginal);
  const extension = extensionMatch ? extensionMatch[0].toLowerCase() : '.apk';

  return `ourhangout-android-${sanitizeFileNameSegment(version)}${extension}`;
}

function buildContentDispositionFileName(value: string): string {
  return value.replace(/[^\x20-\x7E]+/g, '_').replace(/["\\]/g, '_');
}

function tokenizeVersion(value: string): Array<number | string> {
  return value
    .trim()
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter(Boolean)
    .map((part) => (/^\d+$/.test(part) ? Number(part) : part));
}

function compareVersionTokens(left: number | string, right: number | string): number {
  if (typeof left === 'number' && typeof right === 'number') {
    return left === right ? 0 : left > right ? 1 : -1;
  }
  if (typeof left === 'number') return 1;
  if (typeof right === 'number') return -1;
  const compared = left.localeCompare(right);
  return compared === 0 ? 0 : compared > 0 ? 1 : -1;
}

export function compareVersionStrings(left: string, right: string): number {
  const normalizedLeft = tokenizeVersion(left);
  const normalizedRight = tokenizeVersion(right);
  const maxLength = Math.max(normalizedLeft.length, normalizedRight.length);

  for (let index = 0; index < maxLength; index += 1) {
    const leftToken = normalizedLeft[index] ?? 0;
    const rightToken = normalizedRight[index] ?? 0;
    const compared = compareVersionTokens(leftToken, rightToken);
    if (compared !== 0) {
      return compared;
    }
  }

  return 0;
}

export function buildContentDispositionHeader(fileName: string): string {
  return `attachment; filename="${buildContentDispositionFileName(fileName)}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

export class AppUpdatesService {
  private readonly storageRoot = resolve(process.cwd(), env.APP_UPDATE_STORAGE_DIR || DEFAULT_APP_UPDATE_STORAGE_DIR);

  private readonly manifestPath = resolve(this.storageRoot, 'manifest.json');

  constructor(private readonly logger: FastifyBaseLogger) {}

  private getLatestDownloadUrl(): string {
    return `${trimTrailingSlash(env.PUBLIC_BASE_URL)}/v1/app-updates/download/latest`;
  }

  private getDirectDownloadUrl(fileName: string): string {
    return `${trimTrailingSlash(env.PUBLIC_BASE_URL)}/v1/app-updates/files/${encodeURIComponent(fileName)}`;
  }

  private getReleasePath(fileName: string): string {
    const absolutePath = resolve(this.storageRoot, fileName);
    if (!absolutePath.startsWith(this.storageRoot)) {
      throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'Invalid app release file path.');
    }
    return absolutePath;
  }

  private async ensureStorageRoot(): Promise<void> {
    await fs.mkdir(this.storageRoot, { recursive: true });
  }

  private async readManifest(): Promise<AppUpdateManifest> {
    await this.ensureStorageRoot();

    try {
      const raw = await fs.readFile(this.manifestPath, 'utf8');
      const parsed = JSON.parse(raw) as AppUpdateManifest;
      return {
        history: Array.isArray(parsed.history) ? parsed.history : []
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return { history: [] };
      }

      this.logger.warn({ error }, 'Failed to read app update manifest. Falling back to empty history.');
      return { history: [] };
    }
  }

  private async writeManifest(manifest: AppUpdateManifest): Promise<void> {
    await this.ensureStorageRoot();
    await fs.writeFile(this.manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  }

  private async loadManifest(): Promise<AppUpdateManifest> {
    const manifest = await this.readManifest();
    const nextHistory = manifest.history.slice(0, MAX_RELEASE_HISTORY);
    if (nextHistory.length === manifest.history.length) {
      return manifest;
    }

    const nextManifest = { history: nextHistory };
    await this.writeManifest(nextManifest);
    await this.cleanupOrphanedReleaseFiles(nextHistory);
    return nextManifest;
  }

  private async cleanupOrphanedReleaseFiles(history: StoredAppRelease[]): Promise<void> {
    await this.ensureStorageRoot();
    const keepFileNames = new Set(history.map((record) => record.fileName));
    const entries = await fs.readdir(this.storageRoot, { withFileTypes: true });

    await Promise.all(
      entries.map(async (entry) => {
        if (!entry.isFile()) return;
        if (entry.name === 'manifest.json') return;
        if (keepFileNames.has(entry.name)) return;

        try {
          await fs.unlink(resolve(this.storageRoot, entry.name));
        } catch (error) {
          this.logger.warn({ error, fileName: entry.name }, 'Failed to delete orphaned app update file.');
        }
      })
    );
  }

  private async buildRelease(record: StoredAppRelease, isLatest: boolean): Promise<AppUpdateRelease> {
    let fileExists = false;
    try {
      await fs.access(this.getReleasePath(record.fileName));
      fileExists = true;
    } catch {
      fileExists = false;
    }

    return {
      ...record,
      isLatest,
      fileExists,
      downloadUrl: this.getDirectDownloadUrl(record.fileName),
      latestDownloadUrl: this.getLatestDownloadUrl()
    };
  }

  async listReleases(): Promise<{ latest: AppUpdateRelease | null; items: AppUpdateRelease[] }> {
    const manifest = await this.loadManifest();
    const items = await Promise.all(
      manifest.history.map((record, index) => this.buildRelease(record, index === 0))
    );

    return {
      latest: items[0] ?? null,
      items
    };
  }

  async getLatestStatus(currentVersion?: string): Promise<AppUpdateStatus> {
    const { latest } = await this.listReleases();
    const normalizedCurrentVersion = (currentVersion || '').trim();
    const latestVersion = latest?.version || '';
    const isLatest =
      !latestVersion ||
      !normalizedCurrentVersion ||
      compareVersionStrings(normalizedCurrentVersion, latestVersion) >= 0;

    return {
      currentVersion: normalizedCurrentVersion,
      latestVersion,
      isLatest,
      release: latest?.fileExists ? latest : null
    };
  }

  async uploadRelease(params: UploadAppReleaseParams): Promise<AppUpdateRelease> {
    const version = params.version.trim();
    const notes = (params.notes || '').trim();

    if (!version) {
      throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'Version is required.');
    }
    if (!Buffer.isBuffer(params.bytes) || params.bytes.byteLength === 0) {
      throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'APK binary body is required.');
    }

    const fileName = pickReleaseFileName(version, params.fileName);
    const mimeType = (params.mimeType || '').trim() || DEFAULT_APK_MIME_TYPE;
    const now = new Date().toISOString();
    const nextRelease: StoredAppRelease = {
      version,
      notes,
      fileName,
      originalFileName: (params.fileName || '').trim() || fileName,
      mimeType,
      sizeBytes: params.bytes.byteLength,
      uploadedAt: now,
      publishedAt: now
    };

    await this.ensureStorageRoot();
    await fs.writeFile(this.getReleasePath(fileName), params.bytes);

    const manifest = await this.loadManifest();
    const nextHistory = [
      nextRelease,
      ...manifest.history.filter((record) => record.version !== version)
    ].slice(0, MAX_RELEASE_HISTORY);

    await this.writeManifest({ history: nextHistory });
    await this.cleanupOrphanedReleaseFiles(nextHistory);

    return this.buildRelease(nextRelease, true);
  }

  async deleteRelease(version: string): Promise<DeleteAppReleaseResult> {
    const normalizedVersion = (version || '').trim();
    if (!normalizedVersion) {
      throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'Version is required.');
    }

    const manifest = await this.loadManifest();
    const target = manifest.history.find((record) => record.version === normalizedVersion);
    if (!target) {
      throw new AppError(404, ErrorCodes.RESOURCE_NOT_FOUND, 'App release version not found.');
    }

    const nextHistory = manifest.history.filter((record) => record.version !== normalizedVersion);
    await this.writeManifest({ history: nextHistory });
    await this.cleanupOrphanedReleaseFiles(nextHistory);

    const fileStillReferenced = nextHistory.some((record) => record.fileName === target.fileName);
    let fileDeleted = false;
    if (!fileStillReferenced) {
      try {
        await fs.unlink(this.getReleasePath(target.fileName));
        fileDeleted = true;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw error;
        }
      }
    }

    return {
      version: target.version,
      fileName: target.fileName,
      fileDeleted,
      latestVersion: nextHistory[0]?.version ?? null
    };
  }

  async getLatestDownloadAsset(): Promise<AppUpdateDownloadAsset> {
    const { latest } = await this.listReleases();
    if (!latest || !latest.fileExists) {
      throw new AppError(404, ErrorCodes.RESOURCE_NOT_FOUND, 'No published app update is available yet.');
    }

    return this.getDownloadAssetByFileName(latest.fileName);
  }

  async getDownloadAssetByFileName(fileName: string): Promise<AppUpdateDownloadAsset> {
    const normalizedFileName = (fileName || '').trim();
    if (!normalizedFileName) {
      throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'App release file name is required.');
    }

    const { items } = await this.listReleases();
    const release = items.find((item) => item.fileName === normalizedFileName);
    if (!release) {
      throw new AppError(404, ErrorCodes.RESOURCE_NOT_FOUND, 'App release file not found.');
    }
    if (!release.fileExists) {
      throw new AppError(404, ErrorCodes.RESOURCE_NOT_FOUND, 'App release file is missing on disk.');
    }

    return {
      path: this.getReleasePath(release.fileName),
      fileName: release.fileName,
      mimeType: release.mimeType || DEFAULT_APK_MIME_TYPE,
      sizeBytes: release.sizeBytes
    };
  }
}
